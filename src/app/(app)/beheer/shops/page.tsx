import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { LANGUAGE_LABELS } from "@/lib/format";
import { listShops } from "@/server/admin";

export const metadata = { title: "Shops" };

export default function ShopsPage() {
  return (
    <>
      <PageHeader
        title="Shops"
        description="Elke shop heeft een eigen domein, taal, afzender en Magento-store. Tickets, sjablonen en de kennisbank horen altijd bij één shop."
        actions={
          <Link href="/beheer/shops/nieuw" className="btn btn-secondary">
            Shop toevoegen
          </Link>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <ShopTable />
      </Suspense>
    </>
  );
}

async function ShopTable() {
  const shops = await listShops();
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead className="border-b border-line text-[13px] text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Shop</th>
            <th className="px-4 py-2.5 font-medium">Taal</th>
            <th className="px-4 py-2.5 font-medium">Afzender</th>
            <th className="px-4 py-2.5 font-medium">Magento-store</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <ShopBadge code={shop.code} />
                  <div>
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-[13px] text-muted">{shop.domain}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{LANGUAGE_LABELS[shop.language]}</td>
              <td className="px-4 py-3">
                <div>{shop.senderName}</div>
                <div className="text-[13px] text-muted">{shop.senderEmail}</div>
              </td>
              <td className="tabular px-4 py-3">
                {shop.magentoStoreId ?? "Niet ingesteld"}
              </td>
              <td className="px-4 py-3 text-right">
                {!shop.active && (
                  <span className="mr-3 text-[13px] text-muted">Uitgeschakeld</span>
                )}
                <Link
                  href={`/beheer/shops/${shop.id}`}
                  className="text-link underline-offset-2 hover:underline"
                >
                  Bewerken
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
