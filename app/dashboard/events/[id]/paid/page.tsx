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
            <LinkButton href={`/dashboard/events/${e.id}`} variant="brand" size="lg">
              Get your QR code
            </LinkButton>
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
