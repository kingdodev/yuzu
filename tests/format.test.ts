import { describe, expect, it } from "vitest";
import { isInboxView } from "@/domain/views";
import { contactLabel, shortTime, timeAgo } from "@/lib/format";

describe("weergave", () => {
  it("toont verwijderde klanten zonder technisch adres", () => {
    expect(contactLabel(null, "verwijderd-123@anoniem.invalid")).toBe(
      "Verwijderde klant",
    );
    expect(contactLabel(null, "jan@example.nl")).toBe("jan@example.nl");
    expect(contactLabel("Jan", "jan@example.nl")).toBe("Jan");
  });

  it("schrijft tijden in het Nederlands", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(timeAgo(new Date("2026-10-29T11:42:00Z"), now)).toBe("18 minuten geleden");
    expect(timeAgo(new Date("2026-10-28T12:00:00Z"), now)).toBe("gisteren");
    expect(shortTime(new Date("2026-10-28T09:00:00Z"), now)).toBe("gisteren");
  });

  it("kent alleen de vaste inboxweergaven", () => {
    expect(isInboxView("open")).toBe(true);
    expect(isInboxView("fr")).toBe(true);
    expect(isInboxView("alles")).toBe(false);
  });
});
