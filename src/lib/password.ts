import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** scrypt met N=2^15, r=8, p=1: ongeveer 32 MB en een fractie van een seconde. */
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

/** Versleutel een wachtwoord. Uitkomst: "scrypt$N$r$p$zout$hash" (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    ...PARAMS,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** Klopt het wachtwoord bij de hash? */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || N > 1 << 20) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length === 0) return false;
  const key = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  });
  return timingSafeEqual(key, expected);
}

/**
 * Een hash om tegen te vergelijken als het e-mailadres niet bestaat, zodat
 * inloggen met een onbekend adres even lang duurt als met een bekend adres.
 */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

/** Een willekeurig token voor een cookie of link (256 bits). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Wat we van een token of e-mailadres opslaan: alleen de SHA-256. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
