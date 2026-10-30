import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidStorageKey, type FileStore } from "./types";

const UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

function sign(secret: string, key: string, expires: number): string {
  return createHmac("sha256", secret).update(`${key}:${expires}`).digest("hex");
}

/** Klopt het uploadadres dat we zelf uitgaven? */
export function verifyLocalUpload(
  secret: string,
  key: string,
  expires: number,
  token: string,
  now = Date.now(),
): boolean {
  if (!isValidStorageKey(key) || !Number.isFinite(expires) || expires < now) return false;
  const expected = Buffer.from(sign(secret, key, expires), "hex");
  const given = Buffer.from(token, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Bijlagen in een map op schijf, voor de demo zonder database. De browser
 * uploadt naar /bijlagen/upload met een ondertekend adres, net als bij
 * Supabase.
 */
export function localStore(dir: string, secret: string): FileStore & { secret: string } {
  const file = (key: string) => {
    if (!isValidStorageKey(key)) throw new Error("Ongeldige opslagsleutel");
    return path.join(dir, key);
  };
  return {
    kind: "local",
    secret,

    async createUpload(key, contentType) {
      file(key);
      const expires = Date.now() + UPLOAD_TTL_MS;
      const query = new URLSearchParams({
        key,
        expires: String(expires),
        token: sign(secret, key, expires),
      });
      return {
        url: `/bijlagen/upload?${query}`,
        method: "PUT",
        headers: { "content-type": contentType },
      };
    },

    async put(key, body) {
      const target = file(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    },

    async read(key) {
      try {
        return new Uint8Array(await readFile(file(key)));
      } catch {
        return null;
      }
    },

    async size(key) {
      try {
        return (await stat(file(key))).size;
      } catch {
        return null;
      }
    },

    async remove(keys) {
      await Promise.all(keys.map((key) => rm(file(key), { force: true })));
    },
  };
}
