import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Controle voor adressen die een gebruiker invult en waar de server naartoe
 * gaat (bijv. de Magento-URL van een organisatie). Zonder deze controle kan
 * iemand de server laten praten met interne systemen (SSRF): localhost, het
 * interne netwerk van de hosting, of het metadata-adres van de cloud.
 *
 * Toegestaan: https, standaardpoort, een hostnaam (geen IP-adres) die naar
 * een openbaar IP-adres wijst.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Is dit IP-adres privé, lokaal of anderszins niet openbaar? */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud-metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast en gereserveerd
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      x.startsWith("fc") ||
      x.startsWith("fd") || // unique local
      x.startsWith("fe8") ||
      x.startsWith("fe9") ||
      x.startsWith("fea") ||
      x.startsWith("feb") || // link-local
      x.startsWith("ff") // multicast
    );
  }
  return true;
}

/** Controleer de vorm van het adres (zonder DNS). Geeft de genormaliseerde URL. */
export function parsePublicHttpsUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsafeUrlError("Dit is geen geldig adres.");
  }
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Gebruik een adres dat met https:// begint.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Zet geen gebruikersnaam of wachtwoord in het adres.");
  }
  if (url.port && url.port !== "443") {
    throw new UnsafeUrlError("Gebruik het gewone https-adres, zonder poortnummer.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) throw new UnsafeUrlError("Gebruik de domeinnaam, geen IP-adres.");
  if (!host.includes(".") || /\.(local|localhost|internal|lan|home|corp)$/i.test(host)) {
    throw new UnsafeUrlError("Dit adres is niet openbaar bereikbaar.");
  }
  return url;
}

/** Ook de DNS controleren: alle IP-adressen achter de naam moeten openbaar zijn. */
export async function assertPublicHttpsUrl(
  input: string,
  resolve: (host: string) => Promise<string[]> = async (host) =>
    (await lookup(host, { all: true })).map((r) => r.address),
): Promise<URL> {
  const url = parsePublicHttpsUrl(input);
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname);
  } catch {
    throw new UnsafeUrlError("Dit adres bestaat niet (de domeinnaam is niet gevonden).");
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError("Dit adres is niet openbaar bereikbaar.");
  }
  return url;
}
