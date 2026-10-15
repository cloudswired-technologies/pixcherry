import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/events";

// The event menu lives in the dashboard sidebar (components/dash-shell.tsx).
export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e) notFound();
  return <div className="grid gap-6">{children}</div>;
}
