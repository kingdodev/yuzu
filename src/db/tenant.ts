import { sql } from "drizzle-orm";
import type { Db, Tx } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Voer database-werk uit namens één organisatie.
 *
 * Binnen `fn` draait elke query als rol `yuzu_app` met Row Level Security:
 * je ziet en wijzigt alleen rijen van `organizationId`, ook als je een
 * WHERE-clausule vergeet. Dit is de standaardmanier om de database te
 * gebruiken; alles gebeurt in één transactie.
 *
 * Met `userId` (verzoeken van ingelogde gebruikers, via asTenant) ziet de
 * gebruiker bovendien alleen tickets van shops waar die toegang toe heeft.
 */
export async function withTenant<T>(
  db: Db,
  organizationId: string,
  fn: (t: TenantTx) => Promise<T>,
  options: { userId?: string } = {},
): Promise<T> {
  if (!UUID_RE.test(organizationId)) {
    throw new Error("withTenant: ongeldig organisatie-ID");
  }
  if (options.userId !== undefined && !UUID_RE.test(options.userId)) {
    throw new Error("withTenant: ongeldig gebruikers-ID");
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.organization_id', ${organizationId}, true)`,
    );
    // Namens een gebruiker: dan geldt ook de toegang per shop (0007).
    await tx.execute(
      sql`select set_config('app.user_id', ${options.userId ?? ""}, true)`,
    );
    await tx.execute(sql`set local role yuzu_app`);
    return fn({ tx, organizationId });
  });
}

/** Een transactie die aan één organisatie gebonden is. */
export type TenantTx = { tx: Tx; organizationId: string };

/**
 * Database-werk zonder tenantgrens, voor beheertaken die bewust over
 * organisaties heen gaan: een organisatie of gebruiker aanmaken, migraties,
 * onderhoudsjobs. Gebruik dit nooit voor verzoeken van agents.
 */
export async function withPrivileged<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
