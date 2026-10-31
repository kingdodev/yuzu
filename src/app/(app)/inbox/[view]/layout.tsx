import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InboxColumns } from "@/components/inbox/inbox-columns";
import { TicketList } from "@/components/inbox/ticket-list";
import { ViewsNav } from "@/components/sidebar";
import { Skeleton } from "@/components/ui";
import { isLabelView, isListView, labelIdOf } from "@/domain/views";
import { getLabel } from "@/server/inbox";

export default function InboxLayout({ children, params }: LayoutProps<"/inbox/[view]">) {
  return (
    <InboxColumns
      views={<ViewsNav />}
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
  if (!isListView(view)) notFound();
  if (isLabelView(view)) {
    const label = await getLabel(labelIdOf(view));
    if (!label) notFound();
    return <TicketList view={view} label={label} />;
  }
  return <TicketList view={view} />;
}
