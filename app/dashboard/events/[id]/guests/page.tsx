import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Combine, Heart, Images, MessageCircleHeart, Smartphone, Trash2 } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { listGuests } from "@/lib/guest-admin";
import { publicUrl } from "@/lib/storage";
import { blockGuest, mergeGuestsNow, notSamePhone, removeGuestNow } from "../../actions";

export const metadata = { title: "Guests" };

const SORTS = { photos: "Most photos", new: "Newest", hearts: "Most hearts" } as const;
type Sort = keyof typeof SORTS;

export default async function Guests({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; q?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "photos";
  const term = (sp.q ?? "").trim().toLowerCase();
  const all = await listGuests(e.id);
  const flagged = all.filter((g) => g.same_phone_as);
  const list = all
    .filter((g) => !term || (g.name ?? "guest").toLowerCase().includes(term))
    .sort((a, b) => (sort === "new" ? +b.created_at - +a.created_at : sort === "hearts" ? b.hearts - a.hearts : b.photos - a.photos));
  const base = `/dashboard/events/${e.id}`;
  const limit = e.cfg.limits.max_guests;

  return (
    <div className="grid gap-5">
      <PageHeader title="Guests" sub={`${all.length.toLocaleString("en-MY")} of ${limit.toLocaleString("en-MY")} guests joined · ${e.cfg.limits.photos_per_guest} photos each`} />

      {flagged.length ? (
        <Card className="grid gap-3 border-warn/40 bg-warn-soft/40">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
              <Smartphone className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold">Possibly the same phone ({flagged.length})</h2>
              <p className="text-sm text-muted-foreground">
                These guests joined with the same phone model as an earlier guest, from the same phone or the same small network. It may be one person on two browsers. Merge
                them if it&apos;s one person (one roll), or keep them apart.
              </p>
            </div>
          </div>
          <ul className="grid gap-2">
            {flagged.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 text-sm">
                <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <strong>{g.name ?? "Guest"}</strong> ({g.photos} {g.photos === 1 ? "photo" : "photos"}) looks like <strong>{g.same_phone_name ?? "Guest"}</strong>
                </span>
                <Confirm
                  action={mergeGuestsNow.bind(null, e.id, g.id, g.same_phone_as!)}
                  title={`Merge into ${g.same_phone_name ?? "Guest"}?`}
                  message={`${g.name ?? "This guest"}'s photos and wishes move to ${g.same_phone_name ?? "the first guest"}, and they share one roll of shots.`}
                  confirm="Merge"
                  danger={false}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-xs font-bold text-white"
                >
                  <Combine className="size-3.5" aria-hidden /> Merge
                </Confirm>
                <form action={notSamePhone.bind(null, e.id, g.id)}>
                  <button className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-xs font-semibold">Different people</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SORTS) as Sort[]).map((s) => (
          <Link
            key={s}
            href={`${base}/guests?sort=${s}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
            className={cn("inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold", sort === s ? "bg-ink text-white" : "border border-border bg-card hover:bg-muted")}
          >
            {SORTS[s]}
          </Link>
        ))}
        <form className="ml-auto w-full sm:w-56">
          <input type="hidden" name="sort" value={sort} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search a name…" aria-label="Search guests" className="h-9 w-full rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-ink" />
        </form>
      </div>

      {list.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">{term ? "No guest with that name." : "No guests yet. Share the QR code!"}</Card>
      ) : (
        <ul className="grid gap-2">
          {list.map((g) => (
            <li key={g.id} className={cn("grid gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex sm:items-center", g.is_blocked && "opacity-70")}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {g.avatar_key ? (
                  <img src={publicUrl(g.avatar_key)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-bold text-white">{(g.name ?? "G").charAt(0).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{g.name ?? "Guest"}</span>
                    {g.is_blocked ? <Badge tone="danger">Blocked</Badge> : null}
                    {g.same_phone_as ? <Badge tone="warn">Same phone?</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">Joined {formatDateTime(g.created_at)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Link href={`${base}/photos?guest=${g.id}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                  <Images className="size-4" aria-hidden /> {g.photos}
                </Link>
                <span className="inline-flex items-center gap-1" title="Hearts on their photos">
                  <Heart className="size-4" aria-hidden /> {g.hearts}
                </span>
                <span className="inline-flex items-center gap-1" title="Wishes">
                  <MessageCircleHeart className="size-4" aria-hidden /> {g.wishes}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Confirm
                  action={blockGuest.bind(null, e.id, g.id, !g.is_blocked)}
                  title={g.is_blocked ? `Let ${g.name ?? "this guest"} upload again?` : `Block ${g.name ?? "this guest"}?`}
                  message={g.is_blocked ? "They can share photos and wishes again." : "They can still look at the album, but can't share photos or wishes from this phone. Their photos stay."}
                  confirm={g.is_blocked ? "Unblock" : "Block"}
                  danger={!g.is_blocked}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-muted px-3 text-xs font-semibold"
                >
                  <Ban className="size-3.5" aria-hidden /> {g.is_blocked ? "Unblock" : "Block"}
                </Confirm>
                <Confirm
                  action={removeGuestNow.bind(null, e.id, g.id)}
                  title={`Remove ${g.name ?? "this guest"}?`}
                  message={`Their ${g.photos} photo${g.photos === 1 ? "" : "s"} and ${g.wishes} wish${g.wishes === 1 ? "" : "es"} are deleted, and their guest slot is freed. This can't be undone.`}
                  confirm="Remove guest"
                  label={`Remove ${g.name ?? "guest"}`}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-danger-soft px-3 text-xs font-semibold text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Remove
                </Confirm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
