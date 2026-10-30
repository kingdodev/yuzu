import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { passwordFromHeader, proxy } from "@/proxy";

function basic(user: string, password: string) {
  const bytes = new TextEncoder().encode(`${user}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

function request(auth?: string) {
  return new NextRequest("https://yuzu.example/inbox/open", {
    headers: auth ? { authorization: auth } : {},
  });
}

afterEach(() => {
  delete process.env.DEMO_PASSWORD;
});

describe("wachtwoord op de demo", () => {
  it("laat iedereen door als er geen wachtwoord is ingesteld", () => {
    expect(proxy(request()).status).toBe(200);
  });

  it("vraagt om een wachtwoord als dat is ingesteld", () => {
    process.env.DEMO_PASSWORD = "geheim";
    const res = proxy(request());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
  });

  it("accepteert elke gebruikersnaam met het goede wachtwoord", () => {
    process.env.DEMO_PASSWORD = "geheim";
    expect(proxy(request(basic("frank", "geheim"))).status).toBe(200);
    expect(proxy(request(basic("", "geheim"))).status).toBe(200);
  });

  it("weigert een fout wachtwoord", () => {
    process.env.DEMO_PASSWORD = "geheim";
    expect(proxy(request(basic("frank", "fout"))).status).toBe(401);
  });

  it("werkt met leestekens en letters met accenten", () => {
    process.env.DEMO_PASSWORD = "Yuzü-€:2026!";
    expect(proxy(request(basic("frank", "Yuzü-€:2026!"))).status).toBe(200);
  });

  it("negeert spaties of een regeleinde rond het ingestelde wachtwoord", () => {
    process.env.DEMO_PASSWORD = "  geheim\n";
    expect(proxy(request(basic("frank", "geheim"))).status).toBe(200);
  });

  it("geeft null bij een ongeldige header", () => {
    expect(passwordFromHeader(null)).toBeNull();
    expect(passwordFromHeader("Bearer abc")).toBeNull();
    expect(passwordFromHeader("Basic !!!")).toBeNull();
  });
});
