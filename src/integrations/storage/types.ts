/** Waar een browser een bestand naartoe stuurt bij uploaden. */
export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

/**
 * Opslag voor bijlagen. In productie Supabase Storage (Frankfurt), in de
 * lokale demo een map op schijf. Sleutels zien eruit als
 * `<organisatie-id>/<bijlage-id>`; bestandsnamen staan alleen in de database.
 */
export interface FileStore {
  readonly kind: "supabase" | "local";
  /** Een adres waar de browser het bestand rechtstreeks naartoe kan sturen. */
  createUpload(key: string, contentType: string): Promise<UploadTarget>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** De inhoud, of null als het bestand er niet is. */
  read(key: string): Promise<Uint8Array | null>;
  /** De grootte in bytes, of null als het bestand er (nog) niet is. */
  size(key: string): Promise<number | null>;
  remove(keys: readonly string[]): Promise<void>;
}

const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function storageKeyFor(organizationId: string, attachmentId: string): string {
  const key = `${organizationId}/${attachmentId}`;
  if (!isValidStorageKey(key)) throw new Error("Ongeldige opslagsleutel");
  return key;
}
