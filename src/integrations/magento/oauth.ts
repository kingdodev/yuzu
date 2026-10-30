import { createHmac, randomBytes } from "node:crypto";

/**
 * OAuth 1.0a-ondertekening (RFC 5849) voor Magento-integraties. Daarmee
 * werken de sleutels van een integratie zonder dat in Magento de instelling
 * "integratietokens als bearer-token toestaan" aan hoeft (die staat sinds
 * 2.4.4 standaard uit, en aanzetten is minder veilig).
 */

export type OAuthCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export type SignatureMethod = "HMAC-SHA256" | "HMAC-SHA1";

/** Percent-encoding volgens RFC 3986 (strenger dan encodeURIComponent). */
export function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Querystring zoals verstuurd, met dezelfde codering als in de handtekening. */
export function encodeQuery(params: [string, string][]): string {
  return params.map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).join("&");
}

export function oauthHeader(input: {
  method: "GET";
  /** Adres zonder querystring, bijv. https://shop.nl/rest/V1/orders */
  url: string;
  query: [string, string][];
  credentials: OAuthCredentials;
  signatureMethod: SignatureMethod;
  nonce?: string;
  timestamp?: number;
  /** oauth_version="1.0" meesturen (optioneel volgens de RFC; Magento accepteert het). */
  includeVersion?: boolean;
}): string {
  const oauth: [string, string][] = [
    ["oauth_consumer_key", input.credentials.consumerKey],
    ["oauth_nonce", input.nonce ?? randomBytes(16).toString("hex")],
    ["oauth_signature_method", input.signatureMethod],
    ["oauth_timestamp", String(input.timestamp ?? Math.floor(Date.now() / 1000))],
    ["oauth_token", input.credentials.accessToken],
  ];
  if (input.includeVersion !== false) oauth.push(["oauth_version", "1.0"]);
  const all = [...input.query, ...oauth]
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : 1) : ak < bk ? -1 : 1));
  const base = [
    input.method,
    rfc3986(baseUri(input.url)),
    rfc3986(all.map(([k, v]) => `${k}=${v}`).join("&")),
  ].join("&");
  const key = `${rfc3986(input.credentials.consumerSecret)}&${rfc3986(input.credentials.accessTokenSecret)}`;
  const algorithm = input.signatureMethod === "HMAC-SHA256" ? "sha256" : "sha1";
  const signature = createHmac(algorithm, key).update(base).digest("base64");
  return (
    "OAuth " +
    [...oauth, ["oauth_signature", signature] as [string, string]]
      .map(([k, v]) => `${rfc3986(k)}="${rfc3986(v)}"`)
      .join(", ")
  );
}

/** Schema en host in kleine letters, standaardpoort weg, geen query of fragment. */
function baseUri(url: string): string {
  const u = new URL(url);
  const port =
    (u.protocol === "https:" && u.port === "443") ||
    (u.protocol === "http:" && u.port === "80")
      ? ""
      : u.port
        ? `:${u.port}`
        : "";
  return `${u.protocol}//${u.hostname.toLowerCase()}${port}${u.pathname}`;
}
