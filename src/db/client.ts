import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { demoDataDir } from "@/lib/demo-dir";
import { postgresOptions } from "./connection";
import * as schema from "./schema";
import type { Db } from "./types";

type Cache = { db?: Promise<Db> };
// Bewaard op globalThis, zodat hot reload in ontwikkeling geen nieuwe verbinding opent.
const cache = globalThis as unknown as { __yuzuDb?: Cache };
cache.__yuzuDb ??= {};

/**
 * De database.
 *
 * - Met DATABASE_URL: Supabase Postgres (productie, testomgeving).
 * - Zonder DATABASE_URL: een lokale demodatabase (PGlite) in `.data/`, met
 *   voorbeelddata. Zo is Yuzu te bekijken zonder accounts of koppelingen.
 */
export function getDb(): Promise<Db> {
  const c = cache.__yuzuDb!;
  c.db ??= (
    process.env.DATABASE_URL ? connectPostgres(process.env.DATABASE_URL) : openDemoDb()
  ).catch((error: unknown) => {
    // Niet de mislukte poging bewaren; de volgende aanvraag probeert opnieuw.
    c.db = undefined;
    throw error;
  });
  return c.db;
}

export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

async function connectPostgres(url: string): Promise<Db> {
  const client = postgres(url, postgresOptions(url, 5));
  return drizzle(client, { schema }) as unknown as Db;
}

async function openDemoDb(): Promise<Db> {
  const [{ PGlite }, { drizzle: drizzlePglite }, { migrate }, { seedDemo }, path, fs] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
      import("drizzle-orm/pglite/migrator"),
      import("./seed/demo"),
      import("node:path"),
      import("node:fs"),
    ]);
  // Op Vercel begint de demodata zonder database bij elke nieuwe
  // serverinstantie opnieuw.
  const dataDir = demoDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedDemo(db);
  const [{ getFileStore }, { seedDemoAttachments }] = await Promise.all([
    import("@/integrations/storage"),
    import("./seed/demo-attachments"),
  ]);
  const store = getFileStore();
  if (store) await seedDemoAttachments(db, store);
  return db;
}
