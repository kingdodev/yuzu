/** Rooktest van de tenant-scheiding tegen een echte Postgres (DATABASE_URL). */
import { getDb } from "@/db/client";
import { upsertContact } from "@/db/repositories/contacts";
import { contacts, organizations, shops } from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";

const db = getDb();
const ids = await withPrivileged(db, async (tx) => {
  const made = [];
  for (const slug of ["smoke-a", "smoke-b"]) {
    const [org] = await tx.insert(organizations).values({ name: slug, slug }).returning();
    await tx.insert(shops).values({
      organizationId: org.id, code: "nl", name: "s", domain: "d", language: "nl",
      locale: "nl-NL", senderName: "x", senderEmail: "x@example.com",
    });
    made.push(org.id);
  }
  return made;
});
await withTenant(db, ids[0], (t) => upsertContact(t, { email: "a@example.com" }));
await withTenant(db, ids[1], (t) => upsertContact(t, { email: "b@example.com" }));
const seenA = await withTenant(db, ids[0], ({ tx }) => tx.select().from(contacts));
let blocked = false;
try {
  await withTenant(db, ids[0], ({ tx }) =>
    tx.insert(contacts).values({ organizationId: ids[1], email: "x@example.com" }));
} catch { blocked = true; }
console.log(JSON.stringify({ seenByA: seenA.map((c) => c.email), crossInsertBlocked: blocked }));
process.exit(0);
