import { notFound } from "next/navigation";
import { Camera, MessageCircleHeart, QrCode, UserRound } from "lucide-react";
import { QrCardPanel } from "@/components/qr-card-panel";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getManagedEvent, guestUrl } from "@/lib/events";

export const metadata = { title: "QR & sharing" };

const STEPS = [
  { icon: QrCode, title: "Scan", text: "Guests point their phone camera at the QR card. No app to install." },
  { icon: UserRound, title: "Add their name", text: "So everyone can see who took which photo." },
  { icon: Camera, title: "Snap & share", text: "Take photos with the PixCherry camera or upload from the gallery. They appear live." },
  { icon: MessageCircleHeart, title: "Enjoy together", text: "Hearts, wishes, missions and the slideshow — then everyone keeps the album." },
];

export default async function QrSharing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const url = guestUrl(e.slug);
  return (
    <div className="grid gap-6">
      <PageHeader title="QR & sharing" sub="Put the QR card on every table and at the entrance. Guests scan it to join the album." />
      <Card>
        <QrCardPanel eventId={e.id} slug={e.slug} url={url} />
      </Card>
      <Card>
        <h2 className="text-lg font-bold">How guests join</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-canvas p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <s.icon className="size-5 text-brand" aria-hidden />
              </div>
              <div className="mt-3 font-bold">{s.title}</div>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
