"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { usesDemoSession } from "@/db/connection";
import {
  anyPasswordSet,
  consumeAuthToken,
  createAuthToken,
  createSession,
  deleteSession,
  deleteUserSessions,
  expireAuthTokens,
  findLoginUser,
  getPasswordHash,
  hasOtherMemberships,
  beginLoginAttempt,
  markLoginSuccess,
  peekAuthToken,
  setFirstOwnerPassword as setFirstOwnerPasswordOnce,
  setPasswordHash,
} from "@/db/repositories/auth";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { MAX_PASSWORD_LENGTH, passwordProblem, safeNextPath } from "@/domain/auth";
import { passwordLinkProblem } from "@/domain/permissions";
import { isPlausibleEmail } from "@/domain/contacts";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/lib/password";
import {
  clearSessionCookie,
  clientIpHash,
  emailHash,
  readSessionToken,
  setSessionCookie,
} from "../auth";
import { asAdmin, getSession } from "../session";
import type { FormState } from "./admin";

const WRONG = "E-mailadres of wachtwoord klopt niet.";
const TOO_MANY = "Te veel mislukte pogingen. Probeer het over een kwartier opnieuw.";

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function cleanEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return isPlausibleEmail(email) ? email : null;
}

/**
 * Schrijf een gevoelige actie in de auditlog: van één organisatie (als een
 * beheerder iets doet), of van elke organisatie waar iemand lid van is (als
 * die het zelf doet).
 */
async function auditForUser(
  db: Db,
  userId: string,
  action: string,
  actorUserId: string | null,
  metadata: Record<string, unknown> = {},
  onlyOrganizationId?: string,
) {
  const orgs = onlyOrganizationId
    ? [{ id: onlyOrganizationId }]
    : await withPrivileged(db, (tx) =>
        tx
          .select({ id: s.memberships.organizationId })
          .from(s.memberships)
          .where(eq(s.memberships.userId, userId)),
      );
  for (const org of orgs) {
    await withTenant(db, org.id, ({ tx, organizationId }) =>
      tx.insert(s.auditLog).values({
        organizationId,
        actorType: actorUserId ? "user" : "system",
        actorUserId,
        action,
        entityType: "user",
        entityId: userId,
        metadata,
      }),
    );
  }
}

/** Inloggen met e-mailadres en wachtwoord. */
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = cleanEmail(str(form, "email"));
  const password = str(form, "password");
  if (!email || !password || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: WRONG };
  }
  const db = await getDb();
  const attempt = await beginLoginAttempt(db, {
    emailHash: emailHash(email),
    ipHash: await clientIpHash(),
  });
  if (attempt.blocked) return { ok: false, error: TOO_MANY };

  const user = await findLoginUser(db, email);
  // Ook zonder bekend adres even lang rekenen, zodat je niet kunt afleiden welke adressen bestaan.
  const matches = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await dummyPasswordHash()), false);
  // Een uitgeschakeld account krijgt dezelfde melding, zodat je niet kunt
  // afleiden of het wachtwoord klopte.
  if (!user || !matches || user.activeMemberships === 0) {
    return { ok: false, error: WRONG };
  }

  await markLoginSuccess(db, attempt.attemptId);
  const session = await createSession(db, user.userId);
  await setSessionCookie(session.token, session.expiresAt);
  redirect(safeNextPath(str(form, "next")));
}

export async function logout(): Promise<void> {
  const token = await readSessionToken();
  if (token) await deleteSession(await getDb(), token);
  await clearSessionCookie();
  redirect("/inloggen");
}

/**
 * Het allereerste wachtwoord, voor de eigenaar. Kan alleen zolang nog
 * niemand een wachtwoord heeft, en alleen achter het demowachtwoord
 * (DEMO_PASSWORD), zodat een willekeurige bezoeker dit niet kan doen.
 */
export async function setFirstOwnerPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  if (usesDemoSession()) return { ok: false, error: "Niet nodig in de lokale demo." };
  if (!process.env.DEMO_PASSWORD?.trim()) {
    return {
      ok: false,
      error:
        "Dit kan alleen als de site achter het demowachtwoord staat (DEMO_PASSWORD).",
    };
  }
  const db = await getDb();
  if (await anyPasswordSet(db)) {
    return { ok: false, error: "Er is al een wachtwoord ingesteld. Log gewoon in." };
  }
  const email = cleanEmail(str(form, "email"));
  const password = str(form, "password");
  if (!email) return { ok: false, error: "Vul je e-mailadres in." };
  if (password !== str(form, "password2")) {
    return { ok: false, error: "De twee wachtwoorden zijn niet gelijk." };
  }
  const problem = passwordProblem(password, email);
  if (problem) return { ok: false, error: problem };

  const result = await setFirstOwnerPasswordOnce(db, email, await hashPassword(password));
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "taken"
          ? "Er is al een wachtwoord ingesteld. Log gewoon in."
          : "Dit e-mailadres is geen eigenaar van een organisatie in Yuzu.",
    };
  }
  await auditForUser(db, result.userId, "password_set", result.userId, {
    via: "first_owner",
  });
  const session = await createSession(db, result.userId);
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/inbox/open");
}

/** Een wachtwoord instellen via een uitnodigings- of resetlink. */
export async function setPasswordWithLink(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const token = str(form, "token");
  const password = str(form, "password");
  const db = await getDb();
  const target = await peekAuthToken(db, token);
  if (!target) {
    return {
      ok: false,
      error: "Deze link is verlopen of al gebruikt. Vraag een beheerder om een nieuwe.",
    };
  }
  if (password !== str(form, "password2")) {
    return { ok: false, error: "De twee wachtwoorden zijn niet gelijk." };
  }
  const problem = passwordProblem(password, target.email);
  if (problem) return { ok: false, error: problem };

  const hash = await hashPassword(password);
  // Pas nu verbruiken: zo kun je een tikfout herstellen zonder nieuwe link.
  const used = await consumeAuthToken(db, token);
  if (!used) {
    return {
      ok: false,
      error: "Deze link is verlopen of al gebruikt. Vraag een beheerder om een nieuwe.",
    };
  }
  await setPasswordHash(db, used.userId, hash);
  await deleteUserSessions(db, used.userId);
  await auditForUser(db, used.userId, "password_set", used.userId, { via: used.purpose });

  const session = await createSession(db, used.userId);
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/inbox/open");
}

/** Je eigen wachtwoord wijzigen. Andere browsers worden uitgelogd. */
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  const db = await getDb();
  const current = str(form, "current");
  const next = str(form, "password");
  if (current.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "Je huidige wachtwoord klopt niet." };
  }
  // Ook hier remmen op raden (bijv. met een gestolen sessie).
  const attempt = await beginLoginAttempt(db, {
    emailHash: emailHash(session.email),
    ipHash: await clientIpHash(),
  });
  if (attempt.blocked) return { ok: false, error: TOO_MANY };
  const stored = await getPasswordHash(db, session.userId);
  if (!stored || !(await verifyPassword(current, stored))) {
    return { ok: false, error: "Je huidige wachtwoord klopt niet." };
  }
  await markLoginSuccess(db, attempt.attemptId);
  if (next !== str(form, "password2")) {
    return { ok: false, error: "De twee nieuwe wachtwoorden zijn niet gelijk." };
  }
  if (next === current) {
    return { ok: false, error: "Kies een ander wachtwoord dan je huidige." };
  }
  const problem = passwordProblem(next, session.email);
  if (problem) return { ok: false, error: problem };

  await setPasswordHash(db, session.userId, await hashPassword(next));
  const token = await readSessionToken();
  await deleteUserSessions(db, session.userId, token ?? undefined);
  await expireAuthTokens(db, session.userId);
  await auditForUser(db, session.userId, "password_changed", session.userId);
  return {
    ok: true,
    message: "Wachtwoord gewijzigd. Op andere apparaten moet je opnieuw inloggen.",
  };
}

export type LinkResult =
  | { ok: true; path: string; expiresAt: string; purpose: "invite" | "reset" }
  | { ok: false; error: string };

/**
 * Beheer: maak een link waarmee een collega (opnieuw) een wachtwoord kiest.
 * Tot Mailgun gekoppeld is, kopieert de beheerder die link en stuurt hem zelf.
 */
export async function createPasswordLink(userId: string): Promise<LinkResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Onbekende gebruiker" };
  if (usesDemoSession()) {
    return { ok: false, error: "In de lokale demo is inloggen niet nodig." };
  }
  try {
    const { member, session } = await asAdmin(async ({ tx }, session) => {
      // Alleen leden van je eigen organisatie (RLS).
      const [member] = await tx
        .select({
          userId: s.memberships.userId,
          role: s.memberships.role,
          active: s.memberships.active,
          passwordSetAt: s.users.passwordSetAt,
        })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(eq(s.memberships.userId, parsed.data));
      return { member, session };
    });
    if (!member) return { ok: false, error: "Onbekende gebruiker" };
    if (!member.active) {
      return {
        ok: false,
        error: "Deze gebruiker is uitgeschakeld. Zet hem eerst weer aan.",
      };
    }
    const db = await getDb();
    const problem = passwordLinkProblem({
      actorRole: session.role,
      targetRole: member.role,
      targetHasPassword: member.passwordSetAt !== null,
      targetInOtherOrganization: await hasOtherMemberships(
        db,
        member.userId,
        session.organizationId,
      ),
    });
    if (problem) return { ok: false, error: problem };
    const purpose = member.passwordSetAt ? "reset" : "invite";
    const { token, expiresAt } = await createAuthToken(db, {
      userId: member.userId,
      purpose,
      createdById: session.userId,
    });
    await auditForUser(
      db,
      member.userId,
      "password_link_created",
      session.userId,
      { purpose },
      session.organizationId,
    );
    return {
      ok: true,
      path: `/inloggen/wachtwoord?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
      purpose,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Link maken mislukt" };
  }
}
