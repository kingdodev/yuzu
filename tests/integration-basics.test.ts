import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeQuery, oauthHeader, rfc3986 } from "@/integrations/magento/oauth";
import {
  assertPublicHttpsUrl,
  isPrivateAddress,
  parsePublicHttpsUrl,
} from "@/lib/safe-url";
import { isEncryptionConfigured, openSecret, sealSecret } from "@/lib/secrets";

const KEY = "een-lange-willekeurige-sleutel-voor-tests-1234567890";

describe("versleutelde geheimen", () => {
  it("versleutelt en ontsleutelt, met de organisatie als context", () => {
    const sealed = sealSecret({ token: "geheim" }, "magento:org-a", KEY);
    expect(sealed).not.toContain("geheim");
    expect(openSecret(sealed, "magento:org-a", KEY)).toEqual({ token: "geheim" });
  });

  it("werkt niet bij een andere organisatie of met een andere sleutel", () => {
    const sealed = sealSecret({ token: "geheim" }, "magento:org-a", KEY);
    expect(() => openSecret(sealed, "magento:org-b", KEY)).toThrow();
    expect(() => openSecret(sealed, "magento:org-a", `${KEY}x`)).toThrow();
  });

  it("weigert zonder (voldoende lange) sleutel", () => {
    expect(() => sealSecret({}, "x", "te-kort")).toThrow(/YUZU_ENCRYPTION_KEY/);
    expect(isEncryptionConfigured({ YUZU_ENCRYPTION_KEY: "kort" })).toBe(false);
    expect(isEncryptionConfigured({ YUZU_ENCRYPTION_KEY: KEY })).toBe(true);
  });
});

describe("veilige adressen (tegen SSRF)", () => {
  it("herkent privé- en lokale adressen", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.69", "2a00:1450:4001:80b::200e"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("accepteert alleen https met een openbare domeinnaam", () => {
    expect(parsePublicHttpsUrl("https://www.kingdo.nl").hostname).toBe("www.kingdo.nl");
    expect(() => parsePublicHttpsUrl("http://www.kingdo.nl")).toThrow(/https/);
    expect(() => parsePublicHttpsUrl("https://127.0.0.1")).toThrow(/IP-adres/);
    expect(() => parsePublicHttpsUrl("https://[::1]")).toThrow(/IP-adres/);
    expect(() => parsePublicHttpsUrl("https://localhost")).toThrow(/openbaar/);
    expect(() => parsePublicHttpsUrl("https://magento.internal")).toThrow(/openbaar/);
    expect(() => parsePublicHttpsUrl("https://shop.nl:8443")).toThrow(/poort/);
    expect(() => parsePublicHttpsUrl("https://a:b@shop.nl")).toThrow(/wachtwoord/);
  });

  it("controleert ook waar de domeinnaam naartoe wijst", async () => {
    await expect(
      assertPublicHttpsUrl("https://shop.example.nl", async () => ["93.184.216.34"]),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      assertPublicHttpsUrl("https://stiekem.example.nl", async () => [
        "93.184.216.34",
        "10.0.0.5",
      ]),
    ).rejects.toThrow(/niet openbaar/);
    await expect(
      assertPublicHttpsUrl("https://bestaat-niet.example.nl", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toThrow(/niet gevonden/);
  });
});

describe("OAuth 1.0a voor Magento", () => {
  it("codeert volgens RFC 3986", () => {
    expect(rfc3986("searchCriteria[filter_groups][0]")).toBe(
      "searchCriteria%5Bfilter_groups%5D%5B0%5D",
    );
    expect(rfc3986("a b!*'()")).toBe("a%20b%21%2A%27%28%29");
    expect(encodeQuery([["q", "a b"]])).toBe("q=a%20b");
  });

  it("geeft de handtekening uit het voorbeeld van RFC 5849 (§1.2)", () => {
    const header = oauthHeader({
      method: "GET",
      url: "http://photos.example.net/photos",
      query: [
        ["file", "vacation.jpg"],
        ["size", "original"],
      ],
      credentials: {
        consumerKey: "dpf43f3p2l4k3l03",
        consumerSecret: "kd94hf93k423kf44",
        accessToken: "nnch734d00sl2jdk",
        accessTokenSecret: "pfkkdhi9sl3r4s00",
      },
      signatureMethod: "HMAC-SHA1",
      nonce: "chapoH",
      timestamp: 137131202,
      includeVersion: false,
    });
    expect(header).toContain(
      `oauth_signature="${rfc3986("MdpQcU8iPSUjWoN/UDMsK2sui9I=")}"`,
    );
  });

  it("ondertekent ook met HMAC-SHA256, inclusief querystring met haken", () => {
    const credentials = {
      consumerKey: "ck",
      consumerSecret: "cs",
      accessToken: "at",
      accessTokenSecret: "ats",
    };
    const query: [string, string][] = [["searchCriteria[pageSize]", "1"]];
    const header = oauthHeader({
      method: "GET",
      url: "https://shop.example.nl/rest/V1/orders",
      query,
      credentials,
      signatureMethod: "HMAC-SHA256",
      nonce: "n",
      timestamp: 1,
    });
    const base =
      "GET&https%3A%2F%2Fshop.example.nl%2Frest%2FV1%2Forders&" +
      rfc3986(
        "oauth_consumer_key=ck&oauth_nonce=n&oauth_signature_method=HMAC-SHA256&oauth_timestamp=1&oauth_token=at&oauth_version=1.0&searchCriteria%5BpageSize%5D=1",
      );
    const expected = createHmac("sha256", "cs&ats").update(base).digest("base64");
    expect(header).toContain(`oauth_signature="${rfc3986(expected)}"`);
    expect(header).toContain('oauth_signature_method="HMAC-SHA256"');
  });
});
