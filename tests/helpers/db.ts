import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import { withPrivileged } from "@/db/tenant";
import type { Db } from "@/db/types";

/** Een verse Postgres in het geheugen, met alle migraties toegepast. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db: db as unknown as Db, close: () => client.close() };
}

/** Maak een organisatie met één shop, zoals een beheerder dat zou doen. */
export async function seedOrganization(
  db: Db,
  { slug, shopCode = "nl" }: { slug: string; shopCode?: string },
) {
  return withPrivileged(db, async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: `Org ${slug}`, slug })
      .returning();
    const [shop] = await tx
      .insert(schema.shops)
      .values({
        organizationId: org.id,
        code: shopCode,
        name: `Shop ${slug} ${shopCode}`,
        domain: `${slug}-${shopCode}.example`,
        language: "nl",
        locale: "nl-NL",
        senderName: "Klantenservice",
        senderEmail: `support@${slug}-${shopCode}.example`,
      })
      .returning();
    return { org, shop };
  });
}
