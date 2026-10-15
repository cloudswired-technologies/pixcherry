import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Card, Notice, PageHeader, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listWishes } from "@/lib/engage";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { toggleWish } from "../../actions";

export const metadata = { title: "Wishes" };

export default async function Wishes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  if (!e.cfg.features.wishes) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Wishes" sub="Messages from your guests." />
        <Notice>
          The wishes wall is on a higher package.{" "}
          <Link href={`/dashboard/events/${e.id}/checkout`} className="font-semibold underline">
            Upgrade
          </Link>
        </Notice>
      </div>
    );
  }
  const wishes = await listWishes(e.id, { includeHidden: true, limit: 500 });
  const shown = wishes.filter((w) => !w.hidden).length;
  return (
    <div className="grid gap-5">
      <PageHeader title="Wishes" sub={`${shown} on the wall${wishes.length > shown ? ` · ${wishes.length - shown} hidden` : ""}. Hide anything you don't want guests (or the slideshow) to show.`} />
      {wishes.length ? (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
          {wishes.map((w) => (
            <article key={w.id} className={cn("mb-4 break-inside-avoid rounded-2xl border border-border bg-card p-4 shadow-soft", w.hidden && "opacity-55")}>
              {w.photo ? <img src={w.photo} alt="" className="mb-3 aspect-[4/3] w-full rounded-xl object-cover" /> : null}
              <p className="whitespace-pre-line font-script text-2xl leading-snug">{w.message}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  <strong className="text-brand">{w.name ?? "A guest"}</strong> · {formatDateTime(w.at)}
                </span>
                <form action={toggleWish.bind(null, e.id, w.id, !w.hidden)}>
                  <button className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-semibold">
                    {w.hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                    {w.hidden ? "Show" : "Hide"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center text-sm text-muted-foreground">No wishes yet. They appear here as guests write them.</Card>
      )}
    </div>
  );
}
