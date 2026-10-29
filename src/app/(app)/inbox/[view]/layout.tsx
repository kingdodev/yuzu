import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InboxColumns } from "@/components/inbox/inbox-columns";
import { TicketList } from "@/components/inbox/ticket-list";
import { Skeleton } from "@/components/ui";
import { isInboxView } from "@/domain/views";

export default function InboxLayout({ children, params }: LayoutProps<"/inbox/[view]">) {
  return (
    <InboxColumns
      list={
        <Suspense fallback={<Skeleton lines={10} />}>
          <ListForView params={params} />
        </Suspense>
      }
    >
      {children}
    </InboxColumns>
  );
}

async function ListForView({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!isInboxView(view)) notFound();
  return <TicketList view={view} />;
}
