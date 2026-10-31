"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  applyFilterToExisting,
  deleteFilter as deleteFilterRow,
  saveFilter as saveFilterRow,
  ticketsMatchingFilter,
  type FilterInput,
} from "@/db/repositories/filters";
import * as s from "@/db/schema";
import type { TenantTx } from "@/db/tenant";
import { FILTER_TEXT_MAX, hasAction, hasCondition } from "@/domain/filters";
import { asAdmin, type Session } from "../session";
import type { FormState } from "./admin";

const uuid = z.string().uuid();
const NEW_TAG = "__new";

class UserError extends Error {}

function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.replace(/\s+/g, " ").trim();
  if (trimmed.length > FILTER_TEXT_MAX)
    throw new UserError(`Maximaal ${FILTER_TEXT_MAX} tekens per veld.`);
  return trimmed || null;
}

async function audit(
  t: TenantTx,
  session: Session,
  action: string,
  entityId: string,
  metadata = {},
) {
  await t.tx.insert(s.auditLog).values({
    organizationId: t.organizationId,
    actorType: "user",
    actorUserId: session.userId,
    action,
    entityType: "mail_filter",
    entityId,
    metadata,
  });
}

/** Het label uit het formulier: een bestaand label, of een nieuw label met deze naam. */
async function tagFromForm(t: TenantTx, form: FormData): Promise<string | null> {
  const raw = form.get("tagId");
  if (raw === NEW_TAG) {
    const name = text(form, "newTagName");
    if (!name) throw new UserError("Geef het nieuwe label een naam.");
    if (name.length > 40) throw new UserError("Een labelnaam is hooguit 40 tekens.");
    const [existing] = await t.tx
      .select({ id: s.tags.id })
      .from(s.tags)
      .where(eq(s.tags.name, name));
    if (existing) return existing.id;
    const [tag] = await t.tx
      .insert(s.tags)
      .values({ organizationId: t.organizationId, name, color: "blue" })
      .returning({ id: s.tags.id });
    return tag.id;
  }
  return raw ? uuid.parse(raw) : null;
}

/**
 * Filter maken of wijzigen. Met "ook toepassen op bestaande tickets" krijgen
 * passende tickets meteen het label en worden ze zo nodig gearchiveerd.
 */
export async function saveFilter(_: FormState, form: FormData): Promise<FormState> {
  try {
    const id = form.get("id") ? uuid.parse(form.get("id")) : undefined;
    const shopRaw = form.get("shopId");
    const conditions = {
      fromContains: text(form, "fromContains"),
      subjectContains: text(form, "subjectContains"),
      hasWords: text(form, "hasWords"),
      shopId: shopRaw ? uuid.parse(shopRaw) : null,
    };
    if (!hasCondition(conditions)) {
      return {
        ok: false,
        error: "Vul minstens één voorwaarde in (van, onderwerp, woorden of shop).",
      };
    }
    const skipInbox = form.get("skipInbox") === "on";
    const applyExisting = form.get("applyExisting") === "on";

    const result = await asAdmin(async (t, session) => {
      const tagId = await tagFromForm(t, form);
      if (!hasAction({ tagId, skipInbox })) {
        throw new UserError("Kies een label of zet 'Postvak overslaan' aan.");
      }
      const input: FilterInput = { ...conditions, tagId, skipInbox, enabled: true };
      const row = await saveFilterRow(t, input, id);
      await audit(t, session, id ? "filter_updated" : "filter_created", row.id, {
        tag: Boolean(tagId),
        skipInbox,
      });
      if (!applyExisting) return null;
      return applyFilterToExisting(
        t,
        { ...input, id: row.id },
        {
          type: "user",
          userId: session.userId,
        },
      );
    });
    refresh();
    if (!result)
      return { ok: true, message: id ? "Filter opgeslagen." : "Filter gemaakt." };
    const parts = [
      `${result.matched} bestaande ${result.matched === 1 ? "ticket past" : "tickets passen"}`,
    ];
    if (result.labeled) parts.push(`${result.labeled} kregen het label`);
    if (result.archived) parts.push(`${result.archived} gearchiveerd`);
    return { ok: true, message: `Filter opgeslagen. ${parts.join(", ")}.` };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Controleer de invoer." };
    if (e instanceof Error && e.cause === undefined)
      return { ok: false, error: e.message };
    return { ok: false, error: "Opslaan mislukt. Probeer het opnieuw." };
  }
}

/** Hoeveel bestaande tickets passen op deze voorwaarden? (Gmail: eerst zoeken.) */
export async function previewFilter(input: {
  fromContains: string;
  subjectContains: string;
  hasWords: string;
  shopId: string;
}): Promise<{ count: number; subjects: string[] } | { error: string }> {
  const clean = (v: string) =>
    v.replace(/\s+/g, " ").trim().slice(0, FILTER_TEXT_MAX) || null;
  const rule = {
    id: "voorbeeld",
    fromContains: clean(input.fromContains),
    subjectContains: clean(input.subjectContains),
    hasWords: clean(input.hasWords),
    shopId: input.shopId ? uuid.parse(input.shopId) : null,
    tagId: null,
    skipInbox: false,
    enabled: true,
  };
  if (!hasCondition(rule)) return { error: "Vul eerst minstens één voorwaarde in." };
  const matching = await asAdmin((t) => ticketsMatchingFilter(t, rule));
  return { count: matching.length, subjects: matching.slice(0, 5).map((r) => r.subject) };
}

export async function setFilterEnabled(
  filterId: string,
  enabled: boolean,
): Promise<void> {
  const id = uuid.parse(filterId);
  await asAdmin(async (t, session) => {
    await t.tx
      .update(s.mailFilters)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(s.mailFilters.id, id));
    await audit(t, session, enabled ? "filter_enabled" : "filter_disabled", id);
  });
  refresh();
}

export async function deleteFilter(filterId: string): Promise<void> {
  const id = uuid.parse(filterId);
  await asAdmin(async (t, session) => {
    await deleteFilterRow(t, id);
    await audit(t, session, "filter_deleted", id);
  });
  refresh();
}
