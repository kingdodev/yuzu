import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Geheimen in de database (bijv. Magento-sleutels van een organisatie),
 * versleuteld met AES-256-GCM. De sleutel staat niet in de database maar in
 * de omgevingsvariabele YUZU_ENCRYPTION_KEY (minstens 32 willekeurige
 * tekens). Wie alleen de database heeft, kan de geheimen dus niet lezen.
 *
 * `context` (bijv. "magento:<organisatie-id>") wordt meeversleuteld als
 * "additional data": een versleuteld geheim van de ene organisatie werkt niet
 * als je het bij een andere organisatie in de database zet.
 */

const VERSION = "v1";

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super(
      "Versleuteling is nog niet ingesteld: zet YUZU_ENCRYPTION_KEY (minstens 32 willekeurige tekens) in de hostingomgeving.",
    );
    this.name = "EncryptionNotConfiguredError";
  }
}

function keyFrom(secret: string | undefined): Buffer {
  const material = secret?.trim();
  if (!material || material.length < 32) throw new EncryptionNotConfiguredError();
  return Buffer.from(hkdfSync("sha256", material, "yuzu", "yuzu-secrets-v1", 32));
}

export function isEncryptionConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.YUZU_ENCRYPTION_KEY?.trim().length ?? 0) >= 32;
}

export function sealSecret(
  value: unknown,
  context: string,
  secret = process.env.YUZU_ENCRYPTION_KEY,
): string {
  const key = keyFrom(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function openSecret<T>(
  sealed: string,
  context: string,
  secret = process.env.YUZU_ENCRYPTION_KEY,
): T {
  const key = keyFrom(secret);
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Onbekend formaat van versleuteld geheim");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain) as T;
}
