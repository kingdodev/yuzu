import { describe, expect, it } from "vitest";
import { normalizeEmail, parseAddress } from "@/domain/contacts";
import { extractOrderNumberCandidates } from "@/domain/orders";

describe("e-mailadressen", () => {
  it("normaliseert hoofdletters en spaties", () => {
    expect(normalizeEmail("  Jan.De.Vries@Example.COM ")).toBe("jan.de.vries@example.com");
  });

  it("laat Gmail-punten en +labels staan", () => {
    expect(normalizeEmail("j.an+shop@gmail.com")).toBe("j.an+shop@gmail.com");
  });

  it("weigert onzin", () => {
    expect(() => normalizeEmail("geen adres")).toThrow();
  });

  it("leest naam en adres uit een From-header", () => {
    expect(parseAddress('"Marie Dupont" <Marie@Exemple.fr>')).toEqual({
      name: "Marie Dupont",
      email: "marie@exemple.fr",
    });
    expect(parseAddress("<info@shop.es>")).toEqual({ name: null, email: "info@shop.es" });
    expect(parseAddress("los@adres.nl")).toEqual({ name: null, email: "los@adres.nl" });
  });
});

describe("ordernummers herkennen", () => {
  it("vindt een standaard Magento-ordernummer", () => {
    expect(extractOrderNumberCandidates("Bestelling 000012345 is nog niet binnen")).toEqual([
      "000012345",
    ]);
  });

  it("vindt nummers met een shopprefix", () => {
    expect(
      extractOrderNumberCandidates("Mijn order NL-100045 en BE100046", { prefixes: ["NL", "BE"] }),
    ).toEqual(["NL100045", "BE100046"]);
  });

  it("negeert telefoonnummers, bedragen en datums", () => {
    const text = "Bel me op +31 612345678 of 06-12345678. Ik betaalde 1.234,56 op 12/10/2026.";
    expect(extractOrderNumberCandidates(text)).toEqual([]);
  });

  it("negeert trackingcodes met letters", () => {
    expect(extractOrderNumberCandidates("Track & trace: 3SABCD1234567")).toEqual([]);
  });
});
