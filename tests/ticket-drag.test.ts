import { describe, expect, it } from "vitest";
import {
  decodeDraggedTickets,
  draggedTickets,
  encodeDraggedTickets,
  endTicketDrag,
  isTicketDrag,
  startTicketDrag,
  TICKET_DRAG_TYPE,
} from "@/lib/ticket-drag";

const a = "0b0e3c1a-1111-4222-8333-444455556666";
const b = "1c1f4d2b-2222-4333-8444-555566667777";

describe("tickets slepen naar een label", () => {
  it("neemt de ID's mee, zonder dubbele", () => {
    expect(decodeDraggedTickets(encodeDraggedTickets([a, b, a]))).toEqual([a, b]);
  });

  it("negeert alles wat geen lijst met ticket-ID's is", () => {
    expect(decodeDraggedTickets("")).toEqual([]);
    expect(decodeDraggedTickets("geen json")).toEqual([]);
    expect(decodeDraggedTickets('{"id":"x"}')).toEqual([]);
    expect(decodeDraggedTickets(JSON.stringify([a, "'; drop table", 42]))).toEqual([a]);
  });

  it("herkent een sleep ook als de browser het eigen type niet doorgeeft (Safari)", () => {
    expect(isTicketDrag([])).toBe(false);
    expect(isTicketDrag([TICKET_DRAG_TYPE])).toBe(true);
    startTicketDrag([a, b]);
    expect(isTicketDrag([])).toBe(true);
    expect(isTicketDrag(undefined)).toBe(true);
    expect(draggedTickets()).toEqual([a, b]);
    endTicketDrag();
    expect(isTicketDrag([])).toBe(false);
  });
});
