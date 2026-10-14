import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Check, Trash2 } from "lucide-react";
import { Card, LinkButton, Notice, PageHeader, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { photoKeys, publicUrl } from "@/lib/storage";
import { approve, blockGuest, removePhoto } from "../../actions";

export const metadata = { title: "Photos" };

const PAGE = 60;

export default async function Photos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const view = sp.view === "review" ? "review" : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await q<{ id: string; status: string; ready_at: Date; guest_id: string | null; name: string | null; blocked: boolean | null }>(
    `select p.id, p.status, p.ready_at, p.guest_id, g.name, g.is_blocked as blocked
     from photos p left join guests g on g.id = p.guest_id
     where p.event_id = $1 and p.status ${view === "review" ? "= 'review'" : "in ('ready','review')"}
     order by p.ready_at desc, p.id desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`,
    [e.id],
  );
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const reviewIds = list.filter((r) => r.status === "review").map((r) => r.id);
  const base = `/dashboard/events/${e.id}/photos`;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Photos"
        sub={`${e.photo_count.toLocaleString("en-MY")} photos`}
        actions={
          reviewIds.length ? (
            <form action={approve.bind(null, e.id, reviewIds)}>
              <button className="inline-flex h-10 items-center gap-2 rounded-full bg-ok px-4 text-sm font-semibold text-white">
                <Check className="size-4" aria-hidden /> Approve {reviewIds.length} on this page
              </button>
            </form>
          ) : null
        }
      />
      {e.cfg.features.moderation ? (
        <div className="flex gap-2">
          <LinkButton href={base} variant={view === "all" ? "primary" : "outline"} size="sm">
            All
          </LinkButton>
          <LinkButton href={`${base}?view=review`} variant={view === "review" ? "primary" : "outline"} size="sm">
            Waiting for approval
          </LinkButton>
        </div>
      ) : null}
      {e.cfg.features.moderation && !e.require_approval ? (
        <Notice>
          Photo approval is off, so new photos show straight away. Turn it on in{" "}
          <Link href={`/dashboard/events/${e.id}/settings`} className="font-semibold underline">
            Settings
          </Link>
          .
        </Notice>
      ) : null}

      {list.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">{view === "review" ? "Nothing waiting for approval." : "No photos yet."}</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((p) => (
            <div key={p.id} className={cn("overflow-hidden rounded-xl border bg-card", p.status === "review" ? "border-warn" : "border-border")}>
              <a href={publicUrl(photoKeys(e.id, p.id).md)} target="_blank" rel="noreferrer">
                <img src={publicUrl(photoKeys(e.id, p.id).sm)} alt="" loading="lazy" className="aspect-square w-full bg-muted object-cover" />
              </a>
              <div className="grid gap-1.5 p-2">
                <div className="truncate text-xs font-medium">{p.name ?? "Guest"}</div>
                <div className="text-[11px] text-muted-foreground">{formatDateTime(p.ready_at)}</div>
                <div className="flex flex-wrap gap-1">
                  {p.status === "review" ? (
                    <form action={approve.bind(null, e.id, [p.id])}>
                      <button className="inline-flex h-7 items-center gap-1 rounded-full bg-ok-soft px-2 text-xs font-semibold text-ok">
                        <Check className="size-3.5" aria-hidden /> Approve
                      </button>
                    </form>
                  ) : null}
                  <form action={removePhoto.bind(null, e.id, p.id)}>
                    <button className="inline-flex h-7 items-center gap-1 rounded-full bg-danger-soft px-2 text-xs font-semibold text-danger" aria-label="Delete photo">
                      <Trash2 className="size-3.5" aria-hidden /> Delete
                    </button>
                  </form>
                  {p.guest_id ? (
                    <form action={blockGuest.bind(null, e.id, p.guest_id, !p.blocked)}>
                      <button className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-2 text-xs font-semibold" title={p.blocked ? "Allow this guest to upload again" : "Stop this guest uploading more"}>
                        <Ban className="size-3.5" aria-hidden /> {p.blocked ? "Unblock" : "Block"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between">
        {page > 1 ? (
          <LinkButton href={`${base}?view=${view}&page=${page - 1}`} variant="outline" size="sm">
            Newer
          </LinkButton>
        ) : (
          <span />
        )}
        {more ? (
          <LinkButton href={`${base}?view=${view}&page=${page + 1}`} variant="outline" size="sm">
            Older
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}
