import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getManagedEvent } from "@/lib/events";
import { formatMoney } from "@/lib/format";
import { confirmWithChip } from "@/lib/payments";

export const metadata = { title: "Payment" };

export default async function Paid({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ purchase?: string }> }) {
  const { id } = await params;
  const { purchase } = await searchParams;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !purchase || !/^[0-9a-f-]{36}$/.test(purchase)) notFound();
  const p = await one<{ id: string; description: string; amount_cents: number; event_id: string }>(
    "select id, description, amount_cents, event_id from purchases where id = $1 and event_id = $2",
    [purchase, e.id],
  );
  if (!p) notFound();
  let status: string;
  try {
    status = await confirmWithChip(p.id);
  } catch (err) {
    console.error("confirm failed", err);
    status = "pending";
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="grid justify-items-center gap-3 p-8 text-center">
        {status === "paid" ? (
          <>
            <CheckCircle2 className="size-12 text-ok" aria-hidden />
            <h1 className="text-xl font-bold">You&apos;re all set</h1>
            <p className="text-sm text-muted-foreground">
              {p.description} for &ldquo;{e.name}&rdquo;{p.amount_cents ? ` · ${formatMoney(p.amount_cents)}` : ""}. Your QR code is ready.
            </p>
            <ol className="mt-2 grid w-full gap-2 text-left text-sm">
              {[
                ["🎨", "Make it yours", "Add a cover photo, venue and missions."],
                ["📸", "Try the guest app", "Scan the QR with your phone and snap the first photo."],
                ["🖨️", "Share the QR card", "Download the PDF for the tables or send the image on WhatsApp."],
              ].map(([icon, t, d], i) => (
                <li key={t} className="flex gap-3 rounded-2xl bg-canvas p-3">
                  <span className="text-xl">{icon}</span>
                  <span>
                    <span className="block font-bold">
                      {i + 1}. {t}
                    </span>
                    <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-2 grid w-full gap-2">
              <LinkButton href={`/dashboard/events/${e.id}/qr`} variant="brand" size="lg">
                Get your QR code
              </LinkButton>
              <LinkButton href={`/dashboard/events/${e.id}`} variant="outline" size="lg">
                Go to your event
              </LinkButton>
            </div>
          </>
        ) : status === "failed" ? (
          <>
            <h1 className="text-xl font-bold">Payment not completed</h1>
            <p className="text-sm text-muted-foreground">Nothing was charged. You can try again.</p>
            <LinkButton href={`/dashboard/events/${e.id}/checkout`} size="lg">
              Try again
            </LinkButton>
          </>
        ) : (
          <>
            <Clock className="size-12 text-warn" aria-hidden />
            <h1 className="text-xl font-bold">Confirming your payment…</h1>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds. Refresh this page, or check your email for the receipt.</p>
            <Link href={`/dashboard/events/${e.id}/paid?purchase=${p.id}`} className="text-sm font-semibold underline">
              Refresh
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
