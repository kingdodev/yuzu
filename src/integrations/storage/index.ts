import { randomBytes } from "node:crypto";
import { demoDataDir } from "@/lib/demo-dir";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { FileStore } from "./types";

export type { FileStore, UploadTarget } from "./types";

const cache = globalThis as unknown as { __yuzuFileStore?: FileStore | null };

/**
 * De opslag voor bijlagen:
 *
 * - Met SUPABASE_URL en SUPABASE_SECRET_KEY: Supabase Storage.
 * - Zonder DATABASE_URL (lokale demo): een map naast de demodatabase.
 * - Anders: null. Bijlagen zijn dan nog niet ingesteld.
 */
export function getFileStore(): FileStore | null {
  if (cache.__yuzuFileStore !== undefined) return cache.__yuzuFileStore;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  let store: FileStore | null = null;
  if (url && key) store = supabaseStore(url, key);
  else if (!process.env.DATABASE_URL) {
    store = localStore(`${demoDataDir()}-files`, randomBytes(32).toString("hex"));
  }
  cache.__yuzuFileStore = store;
  return store;
}
