import { sql } from "drizzle-orm";
import { normalizeEmail } from "@/domain/contacts";
import { contacts } from "../schema";
import type { TenantTx } from "../tenant";

/**
 * Zoek een contact op e-mailadres of maak hem aan. Een bestaande naam wordt
 * alleen ingevuld als die nog leeg was; nooit overschreven door een mail.
 */
export async function upsertContact(
  { tx, organizationId }: TenantTx,
  input: { email: string; name?: string | null },
) {
  const email = normalizeEmail(input.email);
  const [row] = await tx
    .insert(contacts)
    .values({ organizationId, email, name: input.name ?? null })
    .onConflictDoUpdate({
      target: [contacts.organizationId, contacts.email],
      set: {
        name: sql`coalesce(${contacts.name}, excluded.name)`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}
