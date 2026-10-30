import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { usesDemoSession } from "@/db/connection";
import { memberships, organizations, users } from "@/db/schema";
import { findSession } from "@/db/repositories/auth";
import { DEMO_ORG_SLUG, DEMO_USER_ID } from "@/db/seed/demo";
import { withPrivileged, withTenant, type TenantTx } from "@/db/tenant";
import { readSessionToken } from "./auth";

import { canManage, isOwner, type Role } from "@/domain/permissions";

export type { Role } from "@/domain/permissions";
export { canManage } from "@/domain/permissions";

export type Session = {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
};

/**
 * De ingelogde gebruiker en zijn organisatie.
 *
 * In de lokale demo zonder database is dat altijd Frank (eigenaar). Anders
 * komt de gebruiker uit de sessiecookie; zonder geldige sessie ga je naar
 * de inlogpagina.
 */
export const getSession = cache(async (): Promise<Session> => {
  const session = await getOptionalSession();
  if (!session) redirect("/inloggen");
  return session;
});

/** Zoals getSession, maar null in plaats van naar de inlogpagina. */
export const getOptionalSession = cache(async (): Promise<Session | null> => {
  await connection();
  const db = await getDb();
  if (usesDemoSession()) {
    const [row] = await withPrivileged(db, (tx) =>
      tx
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          organizationId: organizations.id,
          organizationName: organizations.name,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(and(eq(organizations.slug, DEMO_ORG_SLUG), eq(users.id, DEMO_USER_ID))),
    );
    if (!row) throw new Error("Demo-organisatie niet gevonden");
    return row;
  }
  const token = await readSessionToken();
  if (!token) return null;
  const row = await findSession(db, token);
  if (!row) return null;
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    role: row.role,
  };
});

/** Database-werk namens de ingelogde gebruiker, binnen zijn organisatie. */
export async function asTenant<T>(
  fn: (t: TenantTx, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  const db = await getDb();
  return withTenant(db, session.organizationId, (t) => fn(t, session), {
    userId: session.userId,
  });
}

/** Alleen voor beheerders; anderen gaan terug naar de inbox. */
export async function asAdmin<T>(
  fn: (t: TenantTx, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  if (!canManage(session.role)) redirect("/inbox/open");
  return asTenant(fn);
}

/** Alleen voor de eigenaar (koppelingen, privacy); anderen gaan naar beheer. */
export async function asOwner<T>(
  fn: (t: TenantTx, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  if (!isOwner(session.role)) redirect("/beheer/shops");
  return asTenant(fn);
}
