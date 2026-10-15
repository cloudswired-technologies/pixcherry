import { redirect } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Logo } from "@/components/brand";
import { GUEST_URL } from "@/lib/env";
import { getEventBySlug, guestUrl, renamedSlug } from "@/lib/events";
import { slugify } from "@/lib/slug";

export const metadata = { title: "Find your event album", robots: { index: false, follow: false } };

// app.pixcherry.com: lost the QR code? Type the event link and jump back in.
export default async function FindEvent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const raw = ((await searchParams).q ?? "").trim();
  // Accept a pasted link too ("https://app.pixcherry.com/aina-hakim").
  const typed = slugify(raw.split(/[/?#]/).filter(Boolean).at(-1) ?? "");
  let notFound = false;
  if (typed) {
    const e = await getEventBySlug(typed);
    if (e && e.paid_at && !e.purged_at) redirect(guestUrl(e.slug));
    const moved = e ? null : await renamedSlug(typed);
    if (moved) redirect(guestUrl(moved));
    notFound = true;
  }
  const host = GUEST_URL.replace(/^https?:\/\//, "");
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo className="text-xl" />
        </div>
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-extrabold tracking-tight">Find your event album</h1>
          <p className="mt-1 text-sm text-muted-foreground">Type the event link the hosts shared — the part after {host}/</p>
          <form className="mt-5 grid gap-3">
            <label className="flex h-12 items-center gap-2 rounded-2xl border border-input bg-background px-3 focus-within:border-brand">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="shrink-0 text-sm text-muted-foreground">{host}/</span>
              <input
                name="q"
                defaultValue={raw}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="aina-hakim"
                aria-label="Event link"
                className="h-full min-w-0 flex-1 bg-transparent font-semibold outline-none"
              />
            </label>
            {notFound ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">We couldn&apos;t find “{typed}”. Check the spelling with the hosts.</p> : null}
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold text-white shadow-cherry">
              Open album <ArrowRight className="size-5" aria-hidden />
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Tip: after you open it, add the album to your home screen so it&apos;s one tap away.</p>
      </div>
    </main>
  );
}
