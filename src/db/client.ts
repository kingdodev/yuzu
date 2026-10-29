import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./types";

let cached: Db | undefined;

/**
 * De productiedatabase (Supabase Postgres). Wordt pas bij het eerste gebruik
 * aangemaakt, zodat builds en tests geen DATABASE_URL nodig hebben.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ontbreekt; zie .env.example");
  }
  const client = postgres(url, {
    max: 5,
    // Supabase' transaction pooler ondersteunt geen prepared statements.
    prepare: false,
  });
  cached = drizzle(client, { schema }) as unknown as Db;
  return cached;
}
