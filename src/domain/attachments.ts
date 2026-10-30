/**
 * Regels voor bijlagen: wat mag je uploaden, hoe heet het bestand, en hoe
 * tonen we het veilig. Bijlagen van klanten zijn onbetrouwbaar (zie
 * CLAUDE.md, regel 4): alleen een paar bekende soorten tonen we in de browser,
 * de rest is altijd een download.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
/** Mailgun accepteert berichten tot 25 MB; houd ruimte voor de tekst. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 24 * 1024 * 1024;

/** Soorten die we in de browser tonen (en alleen als extensie en type kloppen). */
const VIEWABLE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** Programma's en scripts sturen we niet naar klanten. */
const BLOCKED = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "cpl",
  "dll",
  "dmg",
  "exe",
  "hta",
  "htm",
  "html",
  "iso",
  "jar",
  "js",
  "jse",
  "lnk",
  "msi",
  "ps1",
  "scr",
  "sh",
  "svg",
  "vbe",
  "vbs",
  "wsf",
]);

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]{1,10})$/i.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

/** Een veilige bestandsnaam: geen mappen, geen vreemde tekens, niet te lang. */
export function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (name.length > 120) {
    const ext = extensionOf(name);
    const keep = ext ? 120 - ext.length - 1 : 120;
    name = ext ? `${name.slice(0, keep).trimEnd()}.${ext}` : name.slice(0, 120);
  }
  return name || "bestand";
}

export type UploadCheck =
  { ok: true; filename: string; contentType: string } | { ok: false; error: string };

/** Mag dit bestand mee met een bericht? */
export function checkUpload(input: {
  filename: string;
  contentType: string;
  size: number;
}): UploadCheck {
  const filename = cleanFilename(input.filename);
  const ext = extensionOf(filename);
  if (BLOCKED.has(ext)) {
    return { ok: false, error: `${filename}: dit soort bestand kan niet mee.` };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: `${filename} is leeg.` };
  }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `${filename} is te groot (${formatBytes(input.size)}). Maximaal ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    };
  }
  const type = input.contentType.trim().toLowerCase();
  const contentType = /^[a-z]+\/[a-z0-9.+-]+$/.test(type)
    ? type
    : (VIEWABLE[ext] ?? "application/octet-stream");
  return { ok: true, filename, contentType };
}

export type Serving = {
  contentType: string;
  /** In de browser tonen in plaats van downloaden. */
  inline: boolean;
  isImage: boolean;
};

/** Hoe we een opgeslagen bijlage teruggeven aan de browser. */
export function servingFor(filename: string, storedType: string): Serving {
  const expected = VIEWABLE[extensionOf(filename)];
  const type = storedType.trim().toLowerCase();
  const matches = expected !== undefined && (type === expected || type === "image/jpg");
  if (!matches) {
    return { contentType: "application/octet-stream", inline: false, isImage: false };
  }
  return {
    contentType: expected,
    inline: true,
    isImage: expected.startsWith("image/"),
  };
}

/** Content-Disposition met de bestandsnaam, ook voor namen met accenten. */
export function contentDisposition(inline: boolean, filename: string): string {
  const ascii = cleanFilename(filename)
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "");
  const encoded = encodeURIComponent(cleanFilename(filename)).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? "inline" : "attachment"}; filename="${ascii || "bestand"}"; filename*=UTF-8''${encoded}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
