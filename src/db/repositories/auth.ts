/**
 * Inloggen, sessies en wachtwoordlinks.
 *
 * Dit is het enige pad dat de inlogtabellen leest en schrijft. Het draait via
 * withPrivileged, omdat bij inloggen nog niet bekend is bij welke organisatie
 * iemand hoort; de app-rol (yuzu_app) kan deze tabellen niet lezen (zie
 * drizzle/0006_inloggen_afschermen.sql). Gebruik deze functies alleen vanuit
 * src/server/auth en de inlogacties.
 */
import { and, asc, count, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  INVITE_DAYS,
  LOGIN_WINDOW_MINUTES,
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  RESET_HOURS,
  SESSION_DAYS,
  SESSION_IDLE_DAYS,
} from "@/domain/auth";
import { randomToken, sha256 } from "@/lib/password";
import {
  authTokens,
  loginAttempts,
  memberships,
  organizations,
  sessions,
  userCredentials,
  users,
} from "../schema";
import { withPrivileged } from "../tenant";
import type { Db } from "../types";

const DAY = 24 * 60 * 60 * 1000;

/** De gebruiker bij een e-mailadres, met wachtwoordhash en of die ergens actief lid is. */
export async function findLoginUser(db: Db, email: string) {
  return withPrivileged(db, async (tx) => {
    const [row] = await tx
      .select({
        userId: users.id,
        email: users.email,
        passwordHash: userCredentials.passwordHash,
      })
      .from(users)
      .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
      .where(eq(users.email, email));
    if (!row) return null;
    const [{ n }] = await tx
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.userId, row.userId), eq(memberships.active, true)));
    return { ...row, activeMemberships: n };
  });
}

// --- Remmen op raden ------------------------------------------------------

export async function isLoginBlocked(
  db: Db,
  key: { emailHash: string; ipHash: string | null },
  now = new Date(),
) {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60 * 1000);
  return withPrivileged(db, async (tx) => {
    const [byEmail] = await tx
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.emailHash, key.emailHash),
          eq(loginAttempts.success, false),
          gt(loginAttempts.createdAt, since),
        ),
      );
    if (byEmail.n >= MAX_FAILURES_PER_EMAIL) return true;
    if (!key.ipHash) return false;
    const [byIp] = await tx
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipHash, key.ipHash),
          eq(loginAttempts.success, false),
          gt(loginAttempts.createdAt, since),
        ),
      );
    return byIp.n >= MAX_FAILURES_PER_IP;
  });
}

export async function recordLoginAttempt(
  db: Db,
  attempt: { emailHash: string; ipHash: string | null; success: boolean },
) {
  await withPrivileged(db, async (tx) => {
    await tx.insert(loginAttempts).values(attempt);
    // Oude pogingen hoeven we niet te bewaren.
    await tx
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, new Date(Date.now() - DAY)));
  });
}

// --- Sessies ---------------------------------------------------------------

/** Log iemand in: nieuwe sessie. Het token gaat in de cookie, de hash in de database. */
export async function createSession(db: Db, userId: string, now = new Date()) {
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
  await withPrivileged(db, async (tx) => {
    await tx.insert(sessions).values({
      userId,
      tokenHash: sha256(token),
      lastSeenAt: now,
      expiresAt,
    });
    await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));
    // Verlopen sessies van deze gebruiker opruimen.
    await tx
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));
  });
  return { token, expiresAt };
}

/**
 * De ingelogde gebruiker bij een sessietoken, met de organisatie waar die
 * actief lid van is (de oudste, als het er meer zijn). Null als de sessie
 * verlopen is, te lang niet gebruikt, of als de gebruiker nergens meer actief is.
 */
export async function findSession(db: Db, token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const idleSince = new Date(now.getTime() - SESSION_IDLE_DAYS * DAY);
  return withPrivileged(db, async (tx) => {
    const [row] = await tx
      .select({
        sessionId: sessions.id,
        lastSeenAt: sessions.lastSeenAt,
        userId: users.id,
        name: users.name,
        email: users.email,
        organizationId: organizations.id,
        organizationName: organizations.name,
        role: memberships.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(
        memberships,
        and(eq(memberships.userId, users.id), eq(memberships.active, true)),
      )
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(
        and(
          eq(sessions.tokenHash, sha256(token)),
          gt(sessions.expiresAt, now),
          gt(sessions.lastSeenAt, idleSince),
        ),
      )
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    if (!row) return null;
    // Hooguit eens per uur bijwerken dat de sessie gebruikt is.
    if (now.getTime() - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
      await tx
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.id, row.sessionId));
    }
    return row;
  });
}

export async function deleteSession(db: Db, token: string) {
  await withPrivileged(db, (tx) =>
    tx.delete(sessions).where(eq(sessions.tokenHash, sha256(token))),
  );
}

/** Log iemand overal uit, eventueel behalve in deze ene sessie. */
export async function deleteUserSessions(db: Db, userId: string, exceptToken?: string) {
  await withPrivileged(db, (tx) =>
    tx
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          exceptToken ? ne(sessions.tokenHash, sha256(exceptToken)) : undefined,
        ),
      ),
  );
}

/** Log iemand uit als die nergens meer actief lid is (na uitschakelen). */
export async function deleteSessionsIfInactive(db: Db, userId: string) {
  await withPrivileged(db, async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.active, true)));
    if (n === 0) await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

// --- Wachtwoorden ----------------------------------------------------------

export async function setPasswordHash(db: Db, userId: string, passwordHash: string) {
  await withPrivileged(db, async (tx) => {
    await tx
      .insert(userCredentials)
      .values({ userId, passwordHash })
      .onConflictDoUpdate({
        target: userCredentials.userId,
        set: { passwordHash, updatedAt: sql`now()` },
      });
    await tx
      .update(users)
      .set({ passwordSetAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(users.id, userId));
  });
}

export async function getPasswordHash(db: Db, userId: string) {
  const [row] = await withPrivileged(db, (tx) =>
    tx
      .select({ hash: userCredentials.passwordHash })
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId)),
  );
  return row?.hash ?? null;
}

/** Heeft al iemand een wachtwoord? Zo niet, dan mag de eigenaar het eerste instellen. */
export async function anyPasswordSet(db: Db) {
  const [row] = await withPrivileged(db, (tx) =>
    tx.select({ n: count() }).from(userCredentials),
  );
  return row.n > 0;
}

/** Een actieve eigenaar met dit e-mailadres, voor het instellen van het eerste wachtwoord. */
export async function findActiveOwner(db: Db, email: string) {
  const [row] = await withPrivileged(db, (tx) =>
    tx
      .select({ userId: users.id })
      .from(users)
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, users.id),
          eq(memberships.role, "owner"),
          eq(memberships.active, true),
        ),
      )
      .where(eq(users.email, email))
      .limit(1),
  );
  return row ?? null;
}

// --- Eenmalige links -------------------------------------------------------

/**
 * Een link om een wachtwoord in te stellen: bij een uitnodiging 7 dagen
 * geldig, bij een reset 24 uur. Eerdere ongebruikte links vervallen.
 */
export async function createAuthToken(
  db: Db,
  input: { userId: string; purpose: "invite" | "reset"; createdById: string | null },
  now = new Date(),
) {
  const token = randomToken();
  const ttl =
    input.purpose === "invite" ? INVITE_DAYS * DAY : RESET_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ttl);
  await withPrivileged(db, async (tx) => {
    await tx
      .update(authTokens)
      .set({ expiresAt: now })
      .where(and(eq(authTokens.userId, input.userId), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({
      userId: input.userId,
      tokenHash: sha256(token),
      purpose: input.purpose,
      createdById: input.createdById,
      expiresAt,
    });
  });
  return { token, expiresAt };
}

/** Bij wie hoort deze link, en is hij nog geldig? Verbruikt hem niet. */
export async function peekAuthToken(db: Db, token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const [row] = await withPrivileged(db, (tx) =>
    tx
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        purpose: authTokens.purpose,
      })
      .from(authTokens)
      .innerJoin(users, eq(users.id, authTokens.userId))
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      ),
  );
  return row ?? null;
}

/**
 * Gebruik de link: in één keer controleren en als gebruikt markeren, zodat
 * hij maar één keer werkt. Geeft de gebruiker terug, of null.
 */
export async function consumeAuthToken(db: Db, token: string, now = new Date()) {
  if (!token || token.length > 200) return null;
  const [row] = await withPrivileged(db, (tx) =>
    tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({ userId: authTokens.userId, purpose: authTokens.purpose }),
  );
  return row ?? null;
}

/** Laat alle openstaande links van iemand vervallen. */
export async function expireAuthTokens(db: Db, userId: string, now = new Date()) {
  await withPrivileged(db, (tx) =>
    tx
      .update(authTokens)
      .set({ expiresAt: now })
      .where(
        and(
          eq(authTokens.userId, userId),
          or(isNull(authTokens.usedAt), gt(authTokens.expiresAt, now)),
        ),
      ),
  );
}
