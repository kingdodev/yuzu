import { createClient } from "@supabase/supabase-js";
import { MAX_ATTACHMENT_BYTES } from "@/domain/attachments";
import type { FileStore } from "./types";

export const ATTACHMENTS_BUCKET = "attachments";

function client(url: string, secretKey: string) {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Bijlagen in Supabase Storage, in een privé-bucket. De server gebruikt de
 * geheime sleutel; browsers krijgen per bestand een ondertekend uploadadres
 * dat twee uur geldig is en alleen voor dat ene bestand werkt.
 */
export function supabaseStore(url: string, secretKey: string): FileStore {
  const bucket = () => client(url, secretKey).storage.from(ATTACHMENTS_BUCKET);
  return {
    kind: "supabase",

    async createUpload(key, contentType) {
      // Nooit een bestaand bestand overschrijven.
      const { data, error } = await bucket().createSignedUploadUrl(key, {
        upsert: false,
      });
      if (error) throw new Error(`Upload voorbereiden mislukt: ${error.message}`);
      return {
        url: data.signedUrl,
        method: "PUT",
        headers: { "content-type": contentType, "x-upsert": "false" },
      };
    },

    async put(key, body, contentType) {
      const { error } = await bucket().upload(key, body, { contentType, upsert: true });
      if (error) throw new Error(`Opslaan mislukt: ${error.message}`);
    },

    async read(key) {
      const { data, error } = await bucket().download(key);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },

    async size(key) {
      const { data, error } = await bucket().info(key);
      if (error || !data) return null;
      return typeof data.size === "number" ? data.size : null;
    },

    async remove(keys) {
      if (keys.length === 0) return;
      const { error } = await bucket().remove([...keys]);
      if (error) throw new Error(`Verwijderen mislukt: ${error.message}`);
    },
  };
}

/** Maak de privé-bucket aan als hij nog niet bestaat (bij elke deploy). */
export async function ensureAttachmentsBucket(url: string, secretKey: string) {
  const storage = client(url, secretKey).storage;
  const existing = await storage.getBucket(ATTACHMENTS_BUCKET);
  if (existing.data) {
    if (existing.data.public) {
      throw new Error(`Bucket "${ATTACHMENTS_BUCKET}" is openbaar; zet hem op privé.`);
    }
    return "bestaat al";
  }
  const { error } = await storage.createBucket(ATTACHMENTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
  });
  if (error) throw new Error(`Bucket aanmaken mislukt: ${error.message}`);
  return "aangemaakt";
}
