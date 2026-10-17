import type { Metadata } from "next";
import QRCode from "qrcode";
import { ArrowRight, Camera, Clock, Monitor, ShieldCheck, Smartphone, Sparkles, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";
import { DEMO_HOURS, DEMO_SHOTS, listDemoCards } from "@/lib/demo";
import { guestUrl } from "@/lib/events";
import { DemoQr } from "./demo-qr";

// Live demo albums: pick an event, open it on two phones, snap on one and
// watch the photo land on the other. Albums are made in Admin → Demo albums.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Try a live demo",
  description: "Open a demo event on two phones, snap on one and watch the photo appear on the other. No sign-up.",
};

const STEPS = [
  { icon: Smartphone, title: "Open a demo on phone 1", text: "Scan an event's QR code below, or tap Open on your phone. Type any name to join." },
  { icon: Users, title: "Join on phone 2", text: "Scan the same QR code with a second phone. On phone 1, the “2nd phone” button shows it too." },
  { icon: Camera, title: "Snap on one, watch the other", text: "Take a photo with Snap or pick one with Upload. It lands on both phones within seconds." },
];

export default async function DemoPage() {
  const cards = await listDemoCards();
  const withQr = await Promise.all(
    cards.map(async (c) => {
      const url = guestUrl(c.liveSlug);
      return { ...c, url, qr: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1f2937", light: "#ffffff" } }) };
    }),
  );

  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* ------------------------------------------------------------ intro */}
        <section className="container-page pb-12 pt-10 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            Live demo
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">Try it with two phones</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Pick an event below and be the guests yourself. What you snap on one phone shows up on the other in seconds, exactly as it would at your event.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl bg-white p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-brand">Step {i + 1}</span>
                </div>
                <h2 className="mt-4 text-lg font-bold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------ events */}
        <section id="events" className="scroll-mt-20 border-y border-border bg-white py-14 sm:py-20">
          <div className="container-page">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pick an event</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Each one is set up on the Exclusive package, with sample photos, snap missions, hashtags and wishes already in.
            </p>

            {withQr.length ? (
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {withQr.map((c) => (
                  <article key={c.key} className="flex flex-col overflow-hidden rounded-3xl bg-paper ring-1 ring-border">
                    <div className="relative">
                      {c.cover ? (
                        <img src={c.cover} alt="" width={1600} height={900} loading="lazy" className="aspect-[16/9] w-full object-cover" />
                      ) : (
                        <div className="aspect-[16/9] w-full bg-muted" />
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-ink shadow-soft">
                        {c.emoji} {c.kind}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-1 gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-extrabold leading-tight tracking-tight">{c.name}</h3>
                          <p className="mt-1.5 text-sm text-muted-foreground">{c.blurb}</p>
                          <p className="mt-3 text-xs font-semibold text-ink/70">
                            {c.photoCount} photo{c.photoCount === 1 ? "" : "s"} · {c.guestCount} guest{c.guestCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        {/* On a computer, scan straight off the screen with both phones. */}
                        <div className="hidden w-28 shrink-0 md:block">
                          <div className="rounded-2xl bg-white p-1.5 ring-1 ring-border [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: c.qr }} />
                          <p className="mt-1.5 text-center text-[11px] font-semibold text-muted-foreground">Scan to open</p>
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <a href={c.url} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-cherry hover:bg-brand-strong">
                          Open demo <ArrowRight className="size-4" aria-hidden />
                        </a>
                        <DemoQr name={c.name} url={c.url} qrSvg={c.qr} />
                        <a
                          href={`${c.url}/slideshow`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-ink hover:bg-muted"
                        >
                          <Monitor className="size-4" aria-hidden /> Slideshow
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-10 rounded-3xl bg-paper p-6 text-muted-foreground">The demo albums are being set up. Please check back in a few minutes.</p>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ notes */}
        <section className="container-page py-14 sm:py-20">
          <h2 className="text-3xl font-extrabold tracking-tight">Good to know</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Clock, title: `Clears after ${DEMO_HOURS} hours`, text: "Photos, wishes and hearts you add are removed a day later, so every visitor starts with a tidy album." },
              { icon: Camera, title: `${DEMO_SHOTS} shots per phone`, text: "Enough to try the film camera, a mission and a hashtag. A real event gets the package's full roll per guest." },
              { icon: Monitor, title: "Try the big screen", text: "Open the slideshow on a laptop or TV, then snap. New photos and wishes pop up as they arrive." },
              { icon: ShieldCheck, title: "Keep it friendly", text: "Anyone trying the demo can see what you share, so snap something you don't mind showing. Every photo is checked automatically." },
            ].map((n) => (
              <div key={n.title} className="rounded-3xl bg-white p-5 shadow-soft">
                <n.icon className="size-6 text-brand" aria-hidden />
                <h3 className="mt-3 font-bold">{n.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid items-center gap-6 rounded-[2rem] bg-ink p-8 text-white sm:p-10 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Sparkles className="size-7 text-brand" aria-hidden />
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Ready for your own event?</h2>
              <p className="mt-2 max-w-xl text-white/75">Set it up in a few minutes: your name, your date, your QR code. Guests need nothing but their phone.</p>
            </div>
            <LinkButton href="/dashboard/events/new" variant="brand" size="lg" className="shadow-cherry">
              Create your event <ArrowRight aria-hidden />
            </LinkButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
