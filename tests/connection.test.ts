import { describe, expect, it } from "vitest";
import { postgresOptions, usesDemoSession } from "@/db/connection";

describe("databaseverbinding", () => {
  it("verbindt versleuteld met Supabase en zonder prepared statements", () => {
    const opts = postgresOptions(
      "postgresql://postgres.abc:geheim@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      5,
    );
    expect(opts.ssl).toBe("require");
    expect(opts.prepare).toBe(false);
    expect(opts.max).toBe(5);
  });

  it("verbindt zonder SSL met een database op deze computer", () => {
    expect(postgresOptions("postgres://u:p@localhost:5432/yuzu", 1).ssl).toBe(false);
    expect(postgresOptions("postgres://u:p@127.0.0.1:5432/yuzu", 1).ssl).toBe(false);
  });
});

describe("demogebruiker", () => {
  it("is Frank zonder database", () => {
    expect(usesDemoSession({})).toBe(true);
  });

  it("is Frank met database, alleen achter het demowachtwoord", () => {
    expect(
      usesDemoSession({ DATABASE_URL: "postgres://x", DEMO_PASSWORD: "geheim" }),
    ).toBe(true);
    expect(usesDemoSession({ DATABASE_URL: "postgres://x" })).toBe(false);
    expect(usesDemoSession({ DATABASE_URL: "postgres://x", DEMO_PASSWORD: "  " })).toBe(
      false,
    );
  });
});
