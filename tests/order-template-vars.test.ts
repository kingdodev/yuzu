import { describe, expect, it } from "vitest";
import { orderTemplateVars, usesOrderVars } from "@/domain/orders";

const orders = [
  { number: "#1003", shipments: [] },
  {
    number: "#1001",
    shipments: [{ carrier: "PostNL", trackingUrl: "https://jouw.postnl.nl/x" }],
  },
];

describe("ordervariabelen in sjablonen", () => {
  it("herkent sjablonen die orders nodig hebben", () => {
    expect(usesOrderVars("Je order {{ordernummer}} is onderweg")).toBe(true);
    expect(usesOrderVars("Hoi {{voornaam}}")).toBe(false);
  });

  it("neemt de gekoppelde order, ook als de mail het nummer zonder # noemt", () => {
    expect(orderTemplateVars(orders, ["1001"])).toEqual({
      ordernummer: "1001",
      vervoerder: "PostNL",
      trackinglink: "https://jouw.postnl.nl/x",
    });
  });

  it("anders de nieuwste order, en leeg zonder orders", () => {
    expect(orderTemplateVars(orders, []).ordernummer).toBe("1003");
    expect(orderTemplateVars([], [])).toEqual({
      ordernummer: "",
      vervoerder: "",
      trackinglink: "",
    });
  });
});
