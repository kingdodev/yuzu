import { describe, expect, it } from "vitest";
import { HEAD_INIT_SCRIPT } from "@/lib/init-scripts";
import {
  VIEWS_PANEL_ATTR,
  VIEWS_PANEL_INIT_SCRIPT,
  VIEWS_PANEL_STORAGE_KEY,
} from "@/lib/views-panel";

function run(stored: string | null, throws = false, script = VIEWS_PANEL_INIT_SCRIPT) {
  const attrs = new Map<string, string>();
  const globals = {
    localStorage: {
      getItem: (k: string) => {
        if (throws) throw new Error("geblokkeerd");
        if (k === "yuzu-theme") return "dark";
        return k === VIEWS_PANEL_STORAGE_KEY ? stored : null;
      },
    },
    document: {
      documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) },
    },
  };
  new Function("localStorage", "document", script)(
    globals.localStorage,
    globals.document,
  );
  return attrs.get(VIEWS_PANEL_ATTR) ?? null;
}

it("thema en weergavenpaneel draaien allebei vanuit <head>", () => {
  expect(run("open", false, HEAD_INIT_SCRIPT)).toBe("open");
});

describe("weergavenpaneel naast een ticket", () => {
  it("staat open als je dat eerder koos, anders dicht", () => {
    expect(run("open")).toBe("open");
    expect(run(null)).toBeNull();
    expect(run("iets anders")).toBeNull();
  });

  it("geen fout als opslag geblokkeerd is (privévenster)", () => {
    expect(run(null, true)).toBeNull();
  });
});
