import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { usesDemoSession } from "@/db/connection";
import { memberships, organizations, users } from "@/db/schema";
import { DEMO_ORG_SLUG, DEMO_USER_ID } from "@/db/seed/demo";
import { withPrivileged, withTenant, type TenantTx } from "@/db/tenant";

export type Role = "owner" | "admin" | "teamlead" | "agent" | "viewer";

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
 * Zolang inloggen niet gebouwd is, is dat altijd Frank (eigenaar): zonder
 * database, of met database achter het demowachtwoord. Zodra inloggen met
 * Google via Supabase Auth gebouwd is, komt de gebruiker uit de sessie.
 */
export const getSession = cache(async (): Promise<Session> => {
  await connection();
  if (!usesDemoSession()) {
    throw new Error(
      "Inloggen is nog niet gebouwd. Zet DEMO_PASSWORD, of draai Yuzu zonder DATABASE_URL.",
    );
  }
  const db = await getDb();
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
});

export function canManage(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/** Database-werk namens de ingelogde gebruiker, binnen zijn organisatie. */
export async function asTenant<T>(
  fn: (t: TenantTx, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  const db = await getDb();
  return withTenant(db, session.organizationId, (t) => fn(t, session));
}

/** Alleen voor beheerders; anderen gaan terug naar de inbox. */
export async function asAdmin<T>(
  fn: (t: TenantTx, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  if (!canManage(session.role)) redirect("/inbox/open");
  return asTenant(fn);
}
