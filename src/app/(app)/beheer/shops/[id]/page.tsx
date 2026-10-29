import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopForm } from "@/components/admin/shop-form";
import { PageHeader, ShopBadge, Skeleton } from "@/components/ui";
import { getShop } from "@/server/admin";

export default function ShopPage({ params }: PageProps<"/beheer/shops/[id]">) {
  return (
    <>
      <Link
        href="/beheer/shops"
        className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Alle shops
      </Link>
      <Suspense fallback={<Skeleton lines={10} />}>
        <ShopLoader params={params} />
      </Suspense>
    </>
  );
}

async function ShopLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "nieuw") {
    return (
      <>
        <PageHeader
          title="Shop toevoegen"
          description="Een nieuwe shop krijgt een eigen weergave in de inbox."
        />
        <ShopForm shop={null} />
      </>
    );
  }
  const shop = await getShop(id);
  if (!shop) notFound();
  return (
    <>
      <PageHeader
        title={shop.name}
        description={
          <span className="inline-flex items-center gap-2">
            <ShopBadge code={shop.code} /> {shop.domain}
          </span>
        }
      />
      <ShopForm shop={shop} />
    </>
  );
}
