import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { recentComments } from "@/lib/comments";
import { getManagedEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { photoKeys, publicUrl } from "@/lib/storage";
import { removeComment } from "../../actions";

export const metadata = { title: "Comments" };

export default async function Comments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const e = await getManagedEvent(id, user);
  if (!e || !e.paid_at) notFound();
  if (!e.cfg.features.comments) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Comments" sub="What guests say under the photos." />
        <Notice>
          Photo comments are on a higher package.{" "}
          <Link href={`/dashboard/events/${e.id}/checkout`} className="font-semibold underline">
            Upgrade
          </Link>
        </Notice>
      </div>
    );
  }
  const comments = await recentComments(e.id, 300);
  return (
    <div className="grid gap-5">
      <PageHeader title="Comments" sub="Newest first. Delete anything that shouldn't be there." />
      {comments.length ? (
        <ul className="grid gap-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
              <a href={publicUrl(photoKeys(e.id, c.photo).md)} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={publicUrl(photoKeys(e.id, c.photo).sm)} alt="" className="size-14 rounded-xl object-cover" />
              </a>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line break-words text-sm">
                  <strong>{c.name ?? "A guest"}</strong> {c.body}
                </p>
                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(c.at)}</div>
              </div>
              <Confirm
                action={removeComment.bind(null, e.id, c.id)}
                title="Delete this comment?"
                message={`“${c.body.slice(0, 80)}${c.body.length > 80 ? "…" : ""}” by ${c.name ?? "a guest"}`}
                confirm="Delete"
                label="Delete comment"
                className="inline-flex h-8 items-center gap-1 rounded-full bg-danger-soft px-3 text-xs font-semibold text-danger"
              >
                <Trash2 className="size-3.5" aria-hidden /> Delete
              </Confirm>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="py-12 text-center text-sm text-muted-foreground">No comments yet.</Card>
      )}
    </div>
  );
}
