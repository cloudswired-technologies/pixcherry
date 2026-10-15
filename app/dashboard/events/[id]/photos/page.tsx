import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { Card, LinkButton, Notice, PageHeader, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { photoKeys, publicUrl } from "@/lib/storage";
import { approve } from "../../actions";
import { PhotoGrid } from "./photo-grid";

export const metadata = { title: "Photos" };

const PAGE = 24;
const UUID = /^[0-9a-f-]{36}$/;
const SORTS = { new: "Newest", top: "Most loved", captioned: "With captions", old: "Oldest" } as const;
type Sort = keyof typeof SORTS;

type SP = { view?: string; page?: string; sort?: string; guest?: string; mission?: string; tag?: string };

export default async function Photos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const f = e.cfg.features;
  const view = sp.view === "review" ? "review" : "all";
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "new";
  const page = Math.max(1, Number(sp.page) || 1);
  const guest = sp.guest && UUID.test(sp.guest) ? sp.guest : null;
  const mission = sp.mission && UUID.test(sp.mission) ? sp.mission : null;
  const tag = sp.tag && /^[a-z0-9_]{2,24}$/.test(sp.tag) ? sp.tag : null;

  const params2: unknown[] = [e.id];
  let where = `p.event_id = $1 and p.status ${view === "review" ? "= 'review'" : "in ('ready','review')"}`;
  if (guest) where += ` and p.guest_id = $${params2.push(guest)}::uuid`;
  if (mission) where += ` and p.mission_id = $${params2.push(mission)}::uuid`;
  if (tag) where += ` and $${params2.push(tag)} = any(p.tags)`;
  const order = { new: "p.ready_at desc nulls last", old: "p.ready_at asc", top: "p.vote_count desc, p.ready_at desc", captioned: "p.ready_at desc nulls last" }[sort];
  if (sort === "captioned") where += " and p.caption is not null";

  const [rows, count, guestName, missions, tags] = await Promise.all([
    q<{ id: string; status: string; ready_at: Date | null; guest_id: string | null; name: string | null; vote_count: number; caption: string | null; tags: string[]; emoji: string | null }>(
      `select p.id, p.status, p.ready_at, p.guest_id, g.name, p.vote_count, p.caption, p.tags, m.emoji
       from photos p left join guests g on g.id = p.guest_id left join event_missions m on m.id = p.mission_id
       where ${where} order by ${order}, p.id desc limit ${PAGE + 1} offset ${(page - 1) * PAGE}`,
      params2,
    ),
    one<{ n: number }>(`select count(*)::int n from photos p where ${where}`, params2),
    guest ? one<{ name: string | null }>("select name from guests where id = $1 and event_id = $2", [guest, e.id]) : Promise.resolve(null),
    f.missions ? q<{ id: string; title: string; emoji: string | null }>("select id, title, emoji from event_missions where event_id = $1 order by sort, created_at", [e.id]) : Promise.resolve([]),
    f.tags
      ? q<{ tag: string; n: number }>(
          "select t.tag, count(*)::int n from photos p cross join lateral unnest(p.tags) t(tag) where p.event_id = $1 and p.status = 'ready' group by t.tag order by n desc limit 20",
          [e.id],
        )
      : Promise.resolve([]),
  ]);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const reviewIds = list.filter((r) => r.status === "review").map((r) => r.id);
  const base = `/dashboard/events/${e.id}/photos`;
  const link = (patch: Partial<SP>) => {
    const u = new URLSearchParams();
    const next = { view: view === "review" ? "review" : undefined, sort: sort === "new" ? undefined : sort, guest: guest ?? undefined, mission: mission ?? undefined, tag: tag ?? undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  const pill = (on: boolean) => cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold", on ? "bg-ink text-white" : "border border-border bg-card hover:bg-muted");
  const total = count?.n ?? 0;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Photos"
        sub={`${total.toLocaleString("en-MY")} photo${total === 1 ? "" : "s"}${guestName ? ` by ${guestName.name ?? "Guest"}` : ""}${tag ? ` tagged #${tag}` : ""}`}
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

      <div className="grid gap-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link key={s} href={link({ sort: s === "new" ? undefined : s, page: undefined })} className={pill(sort === s)}>
              {SORTS[s]}
            </Link>
          ))}
          {f.moderation ? (
            <Link href={link({ view: view === "review" ? undefined : "review", page: undefined })} className={pill(view === "review")}>
              Waiting for approval
            </Link>
          ) : null}
        </div>
        {missions.length || tags.length ? (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {missions.map((m) => (
              <Link key={m.id} href={link({ mission: mission === m.id ? undefined : m.id, page: undefined })} className={pill(mission === m.id)}>
                {m.emoji ?? "🎯"} {m.title}
              </Link>
            ))}
            {tags.map((t) => (
              <Link key={t.tag} href={link({ tag: tag === t.tag ? undefined : t.tag, page: undefined })} className={pill(tag === t.tag)}>
                #{t.tag} <span className="opacity-60">{t.n}</span>
              </Link>
            ))}
          </div>
        ) : null}
        {guest ? (
          <Link href={link({ guest: undefined, page: undefined })} className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
            {guestName?.name ?? "Guest"} <X className="size-4" aria-label="Clear" />
          </Link>
        ) : null}
      </div>

      {f.moderation && !e.require_approval && view === "review" ? (
        <Notice>
          Photo approval is off, so new photos show straight away. Turn it on in{" "}
          <Link href={`/dashboard/events/${e.id}/settings`} className="font-semibold underline">
            Settings
          </Link>
          .
        </Notice>
      ) : null}

      {list.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">{view === "review" ? "Nothing waiting for approval." : "No photos here yet."}</Card>
      ) : (
        <PhotoGrid
          eventId={e.id}
          slug={e.slug}
          photos={list.map((p) => {
            const k = photoKeys(e.id, p.id);
            return {
              id: p.id,
              sm: publicUrl(k.sm),
              md: publicUrl(k.md),
              full: publicUrl(k.full),
              name: p.name,
              guestHref: p.guest_id ? link({ guest: p.guest_id, page: undefined }) : null,
              at: p.ready_at ? formatDateTime(p.ready_at) : "Processing",
              caption: p.caption,
              tags: p.tags ?? [],
              votes: p.vote_count,
              emoji: p.emoji,
              review: p.status === "review",
            };
          })}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        {page > 1 ? (
          <LinkButton href={link({ page: String(page - 1) })} variant="outline" size="sm">
            Previous
          </LinkButton>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          Page {page} of {Math.max(1, Math.ceil(total / PAGE))}
        </span>
        {more ? (
          <LinkButton href={link({ page: String(page + 1) })} variant="outline" size="sm">
            Next
          </LinkButton>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
