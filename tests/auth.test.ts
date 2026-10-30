import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anyPasswordSet,
  consumeAuthToken,
  createAuthToken,
  createSession,
  deleteSession,
  deleteSessionsIfInactive,
  deleteUserSessions,
  findActiveOwner,
  findLoginUser,
  findSession,
  isLoginBlocked,
  peekAuthToken,
  recordLoginAttempt,
  setPasswordHash,
} from "@/db/repositories/auth";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import {
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  passwordProblem,
  safeNextPath,
} from "@/domain/auth";
import { hashPassword, sha256, verifyPassword } from "@/lib/password";
import { expectDbError } from "./helpers/errors";
import { createTestDb, seedOrganization } from "./helpers/db";

describe("wachtwoorden", () => {
  it("versleutelt met scrypt en herkent alleen het goede wachtwoord", async () => {
    const hash = await hashPassword("Correct-Paard-Batterij");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain("Correct");
    expect(await verifyPassword("Correct-Paard-Batterij", hash)).toBe(true);
    expect(await verifyPassword("correct-paard-batterij", hash)).toBe(false);
    // Twee keer hetzelfde wachtwoord geeft een andere hash (zout).
    expect(await hashPassword("Correct-Paard-Batterij")).not.toBe(hash);
  });

  it("weigert een kapotte of vreemde hash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$99999999$8$1$AAAA$AAAA")).toBe(false);
  });

  it("stelt eisen aan een nieuw wachtwoord", () => {
    expect(passwordProblem("kort")).toMatch(/minstens/);
    expect(passwordProblem("wachtwoord123")).toMatch(/te makkelijk/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/te makkelijk/);
    expect(passwordProblem("Gele-yuzu-op-zondag", "frank@kingdo.nl")).toBeNull();
    expect(passwordProblem("frank-is-de-baas", "frank@kingdo.nl")).toMatch(/e-mailadres/);
    expect(passwordProblem("ikbenfrank1234", "ikbenfrank@kingdo.nl")).toMatch(
      /e-mailadres/,
    );
    expect(passwordProblem("Gele-yuzu-op-zondag")).toBeNull();
  });

  it("stuurt na inloggen alleen naar pagina's binnen Yuzu", () => {
    expect(safeNextPath("/zoeken?q=plaid")).toBe("/zoeken?q=plaid");
    expect(safeNextPath(null)).toBe("/inbox/open");
    expect(safeNextPath("https://kwaad.example")).toBe("/inbox/open");
    expect(safeNextPath("//kwaad.example")).toBe("/inbox/open");
    expect(safeNextPath("/\\kwaad.example")).toBe("/inbox/open");
    expect(safeNextPath("/inloggen")).toBe("/inbox/open");
  });
});

describe("inloggen in de database", () => {
  let db: Db;
  let close: () => Promise<void>;
  let org: Awaited<ReturnType<typeof seedOrganization>>;
  const owner = randomUUID();
  const agent = randomUUID();
  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    org = await seedOrganization(db, { slug: "inloggen" });
    await withPrivileged(db, async (tx) => {
      await tx.insert(s.users).values([
        { id: owner, email: "eigenaar@example.nl", name: "Eigenaar" },
        { id: agent, email: "agent@example.nl", name: "Agent" },
      ]);
      await tx.insert(s.memberships).values([
        { organizationId: org.org.id, userId: owner, role: "owner" },
        { organizationId: org.org.id, userId: agent, role: "agent" },
      ]);
    });
  });
  afterAll(async () => close());

  it("de app-rol kan wachtwoorden, sessies en links niet lezen", async () => {
    for (const table of [
      "user_credentials",
      "sessions",
      "auth_tokens",
      "login_attempts",
    ]) {
      await expectDbError(
        withTenant(db, org.org.id, ({ tx }) =>
          tx.execute(sql.raw(`select * from ${table}`)),
        ),
        /permission denied/,
      );
    }
  });

  it("kent het eerste wachtwoord alleen toe aan een actieve eigenaar", async () => {
    expect(await anyPasswordSet(db)).toBe(false);
    expect(await findActiveOwner(db, "eigenaar@example.nl")).toEqual({ userId: owner });
    expect(await findActiveOwner(db, "agent@example.nl")).toBeNull();
    await setPasswordHash(db, owner, await hashPassword("Gele-yuzu-op-zondag"));
    expect(await anyPasswordSet(db)).toBe(true);

    const found = await findLoginUser(db, "eigenaar@example.nl");
    expect(found).toMatchObject({ userId: owner, activeMemberships: 1 });
    expect(await verifyPassword("Gele-yuzu-op-zondag", found!.passwordHash!)).toBe(true);
    const [user] = await withPrivileged(db, (tx) =>
      tx
        .select()
        .from(s.users)
        .where(sql`${s.users.id} = ${owner}`),
    );
    expect(user.passwordSetAt).toBeInstanceOf(Date);
  });

  it("houdt een sessie bij, die verloopt na 30 dagen of 7 dagen niet gebruiken", async () => {
    const now = new Date();
    const { token } = await createSession(db, owner, now);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const session = await findSession(db, token, now);
    expect(session).toMatchObject({
      userId: owner,
      organizationId: org.org.id,
      role: "owner",
    });
    // Alleen de hash staat in de database.
    const rows = await withPrivileged(db, (tx) => tx.select().from(s.sessions));
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows.some((r) => r.tokenHash === sha256(token))).toBe(true);

    expect(await findSession(db, token, new Date(now.getTime() + 8 * DAY))).toBeNull();
    expect(await findSession(db, "verzonnen", now)).toBeNull();

    // Steeds gebruikt, maar na 30 dagen toch weer inloggen.
    const later = new Date(now.getTime() + 6 * DAY);
    await findSession(db, token, later);
    expect(
      await findSession(db, token, new Date(now.getTime() + 12 * DAY)),
    ).not.toBeNull();
    expect(await findSession(db, token, new Date(now.getTime() + 31 * DAY))).toBeNull();

    await deleteSession(db, token);
    expect(await findSession(db, token)).toBeNull();
  });

  it("logt iemand uit die nergens meer actief is", async () => {
    const { token } = await createSession(db, agent);
    expect(await findSession(db, token)).not.toBeNull();
    await withPrivileged(db, (tx) =>
      tx
        .update(s.memberships)
        .set({ active: false })
        .where(sql`${s.memberships.userId} = ${agent}`),
    );
    expect(await findSession(db, token)).toBeNull();
    await deleteSessionsIfInactive(db, agent);
    const left = await withPrivileged(db, (tx) =>
      tx
        .select()
        .from(s.sessions)
        .where(sql`${s.sessions.userId} = ${agent}`),
    );
    expect(left).toEqual([]);
    await withPrivileged(db, (tx) =>
      tx
        .update(s.memberships)
        .set({ active: true })
        .where(sql`${s.memberships.userId} = ${agent}`),
    );
  });

  it("logt overal uit behalve in de huidige sessie", async () => {
    const a = await createSession(db, owner);
    const b = await createSession(db, owner);
    await deleteUserSessions(db, owner, a.token);
    expect(await findSession(db, a.token)).not.toBeNull();
    expect(await findSession(db, b.token)).toBeNull();
  });

  it("een link werkt één keer en vervalt", async () => {
    const now = new Date();
    const first = await createAuthToken(
      db,
      { userId: agent, purpose: "invite", createdById: owner },
      now,
    );
    expect(await peekAuthToken(db, first.token, now)).toMatchObject({
      email: "agent@example.nl",
      purpose: "invite",
    });
    // Een nieuwe link maakt de vorige ongeldig.
    const second = await createAuthToken(
      db,
      { userId: agent, purpose: "invite", createdById: owner },
      now,
    );
    expect(await peekAuthToken(db, first.token, now)).toBeNull();

    expect(
      await peekAuthToken(db, second.token, new Date(now.getTime() + 8 * DAY)),
    ).toBeNull();
    expect(await consumeAuthToken(db, second.token, now)).toEqual({
      userId: agent,
      purpose: "invite",
    });
    expect(await consumeAuthToken(db, second.token, now)).toBeNull();

    const reset = await createAuthToken(
      db,
      { userId: agent, purpose: "reset", createdById: owner },
      now,
    );
    expect(
      await consumeAuthToken(
        db,
        reset.token,
        new Date(now.getTime() + 25 * 60 * 60 * 1000),
      ),
    ).toBeNull();
  });

  it("remt raden per e-mailadres en per IP-adres", async () => {
    const key = {
      emailHash: sha256("email:doelwit@example.nl"),
      ipHash: sha256("ip:1.2.3.4"),
    };
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL - 1; i++) {
      await recordLoginAttempt(db, { ...key, success: false });
    }
    expect(await isLoginBlocked(db, key)).toBe(false);
    await recordLoginAttempt(db, { ...key, success: false });
    expect(await isLoginBlocked(db, key)).toBe(true);
    // Een ander adres vanaf hetzelfde IP mag nog.
    const other = { emailHash: sha256("email:ander@example.nl"), ipHash: key.ipHash };
    expect(await isLoginBlocked(db, other)).toBe(false);
    // Na een kwartier weer wel.
    expect(await isLoginBlocked(db, key, new Date(Date.now() + 16 * 60 * 1000))).toBe(
      false,
    );

    const ipKey = { emailHash: "x", ipHash: sha256("ip:5.6.7.8") };
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      await recordLoginAttempt(db, {
        emailHash: sha256(`email:${i}@example.nl`),
        ipHash: ipKey.ipHash,
        success: false,
      });
    }
    expect(await isLoginBlocked(db, ipKey)).toBe(true);
  });
});
