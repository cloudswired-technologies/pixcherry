import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/events";
import { pendingReviewCount } from "@/lib/photos";
import { EventTabs } from "./event-tabs";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  const review = e.paid_at ? await pendingReviewCount(e.id) : 0;
  return (
    <div className="grid gap-6">
      {e.paid_at ? <EventTabs id={e.id} review={review} /> : null}
      {children}
    </div>
  );
}
