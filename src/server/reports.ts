import "server-only";
import { sql } from "drizzle-orm";
import { asTenant } from "./session";

type Row = Record<string, unknown>;
function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as T[];
}

/** Basiscijfers voor de rapportagepagina. Tijden in werkelijke minuten, nog niet in werkuren. */
export function getReport() {
  return asTenant(async ({ tx }) => {
    const [totals, perShop, perIntent, perDay, ai] = await Promise.all([
      tx.execute(sql`
        select
          count(*) filter (where status in ('new','open'))::int as open,
          count(*) filter (where status in ('pending_customer','pending_third_party'))::int as waiting,
          count(*) filter (where created_at >= date_trunc('day', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')::int as new_today,
          (select count(*) from ticket_events e where e.type = 'status_changed' and e.to_value = 'solved' and e.created_at > now() - interval '7 days')::int as solved_week,
          (percentile_cont(0.5) within group (order by extract(epoch from first_response_at - created_at) / 60)
             filter (where first_response_at is not null and created_at > now() - interval '30 days'))::float as median_first_response_min
        from tickets`),
      tx.execute(sql`
        select s.code, s.name,
          count(t.id) filter (where t.status in ('new','open'))::int as open,
          count(t.id) filter (where t.created_at > now() - interval '30 days')::int as month
        from shops s left join tickets t on t.shop_id = s.id
        group by s.id order by s.magento_store_id nulls last, s.name`),
      tx.execute(sql`
        select coalesce(intent, 'other') as intent, count(*)::int as n
        from tickets where created_at > now() - interval '30 days'
        group by 1 order by 2 desc`),
      tx.execute(sql`
        select to_char(d, 'YYYY-MM-DD') as day, count(t.id)::int as n
        from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
        left join tickets t on date_trunc('day', t.created_at) = d
        group by d order by d`),
      tx.execute(sql`
        select status, count(*)::int as n from ai_drafts
        where created_at > now() - interval '30 days' group by status`),
    ]);
    const t = rows<{
      open: number;
      waiting: number;
      new_today: number;
      solved_week: number;
      median_first_response_min: number | null;
    }>(totals)[0];
    const aiRows = rows<{ status: string; n: number }>(ai);
    const aiCount = (s: string) => aiRows.find((r) => r.status === s)?.n ?? 0;
    return {
      totals: t,
      perShop: rows<{ code: string; name: string; open: number; month: number }>(perShop),
      perIntent: rows<{ intent: string; n: number }>(perIntent),
      perDay: rows<{ day: string; n: number }>(perDay),
      ai: {
        used: aiCount("used"),
        discarded: aiCount("discarded"),
        pending: aiCount("pending"),
      },
    };
  });
}
