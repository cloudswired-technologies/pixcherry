import { redirect } from "next/navigation";

// Split into Missions, Wishes and Comments (sidebar).
export default async function Engage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/dashboard/events/${(await params).id}/missions`);
}
