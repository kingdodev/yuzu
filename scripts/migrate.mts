/**
 * Pas databasemigraties toe op de database in DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * Met --if-configured stopt het script stil als DATABASE_URL ontbreekt; zo
 * draait het bij elke deploy op Vercel (zie "vercel-build" in package.json)
 * en slaat het de demo zonder database over.
 *
 * Met SUPABASE_URL en SUPABASE_SECRET_KEY maakt het ook de privé-bucket voor
 * bijlagen aan. Staat DEMO_PASSWORD aan, dan is dit de demo-omgeving en
 * worden ook de voorbeeldgegevens geladen, maar alleen als ze er nog niet zijn.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { postgresOptions } from "../src/db/connection";
import * as schema from "../src/db/schema";
import { seedDemo } from "../src/db/seed/demo";
import { seedDemoAttachments } from "../src/db/seed/demo-attachments";
import {
  ensureAttachmentsBucket,
  supabaseStore,
} from "../src/integrations/storage/supabase";
import type { Db } from "../src/db/types";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  if (process.argv.includes("--if-configured")) {
    console.log("Geen DATABASE_URL: migraties overgeslagen (demo zonder database).");
    process.exit(0);
  }
  console.error("DATABASE_URL ontbreekt");
  process.exit(1);
}

const client = postgres(url, postgresOptions(url, 1));
try {
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migraties toegepast.");

  // Opslag voor bijlagen (Supabase Storage), als die is ingesteld.
  const storageUrl = process.env.SUPABASE_URL?.trim();
  const storageKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const store = storageUrl && storageKey ? supabaseStore(storageUrl, storageKey) : null;
  if (storageUrl && storageKey) {
    console.log(
      `Bucket voor bijlagen: ${await ensureAttachmentsBucket(storageUrl, storageKey)}.`,
    );
  } else {
    console.log("Geen SUPABASE_URL/SUPABASE_SECRET_KEY: bijlagen nog niet ingesteld.");
  }

  if (process.env.DEMO_PASSWORD?.trim()) {
    await seedDemo(db as unknown as Db);
    if (store) {
      const added = await seedDemoAttachments(db as unknown as Db, store);
      if (added > 0) console.log(`${added} voorbeeldbijlagen toegevoegd.`);
    }
    console.log("Voorbeeldgegevens aanwezig.");
  }
} finally {
  await client.end();
}
