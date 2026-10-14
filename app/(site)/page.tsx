import { Camera, Download, QrCode, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: QrCode, title: "Put up one QR code", text: "Create your event, then print the QR code or show it on a screen at the venue." },
  { icon: Camera, title: "Guests scan and snap", text: "No app, no sign-up. Guests open the page, take or pick photos and upload in seconds." },
  { icon: Download, title: "One album for everyone", text: "Every photo lands in one shared gallery. Download the whole album when the party's over." },
];

const POINTS = [
  { icon: Timer, title: "Ready in two minutes", text: "Name, date, pay once. Your QR code is ready straight away." },
  { icon: Sparkles, title: "Made for phones", text: "Photos are resized on the guest's phone, so uploads stay quick even on venue 4G." },
  { icon: ShieldCheck, title: "Private by default", text: "Each gallery lives at a secret link. Location data is removed from every photo." },
];

const FAQ = [
  ["Do guests need to download an app?", "No. They scan the QR code and the page opens in their phone's browser."],
  ["How long are the photos kept?", "It depends on the package. You'll see the exact deletion date on your event page, we email you before it, and you can download everything or add more days any time before then."],
  ["Can I remove a photo?", "Yes. The organiser can delete any photo, and on packages with photo approval you can approve photos before guests see them."],
  ["Is this a subscription?", "No. You pay once per event."],
];

export default async function Home() {
  const plans = await listPlans();
  const from = plans.length ? Math.min(...plans.map((p) => p.price_cents)) : null;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">For weddings, parties and events</span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">Everyone&apos;s photos. One event album.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Put one QR code at your wedding or event. Guests scan, snap and upload. Everyone&apos;s photos come together in one shared gallery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard/events/new" variant="brand" size="lg">
                Create your event
              </LinkButton>
              {from !== null ? <span className="text-sm font-medium text-muted-foreground">From {formatMoney(from)} per event. No subscription.</span> : null}
            </div>
          </div>
          <HeroVisual />
        </section>

        <section id="how" className="border-y border-border bg-card py-16">
          <div className="container-page">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-3xl bg-background p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-ink text-white">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container-page grid gap-6 py-16 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title}>
              <p.icon className="size-6 text-brand" aria-hidden />
              <h3 className="mt-3 font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="bg-ink py-16 text-white">
          <div className="container-page">
            <h2 className="text-3xl font-bold tracking-tight">Simple pricing, once per event</h2>
            <p className="mt-2 text-white/70">Pick a package when you create your event. Upgrade or add more storage any time.</p>
            <div className="mt-10 grid gap-6 text-foreground md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  action={
                    <LinkButton href={`/dashboard/events/new?plan=${p.code}`} variant={p.is_featured ? "brand" : "primary"} className="w-full">
                      Create your event
                    </LinkButton>
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <section className="container-page py-16">
          <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
          <div className="mt-6 grid gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-border bg-card p-5">
                <summary className="cursor-pointer list-none font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const TILES = [
  "from-[#f4b8a8] to-[#e8553d]",
  "from-[#d9cbb8] to-[#a18a6c]",
  "from-[#b9d4c9] to-[#5f8f7d]",
  "from-[#f2dfb0] to-[#d49b2e]",
  "from-[#c9c3e6] to-[#6f63b8]",
  "from-[#f6c9d6] to-[#c45a7a]",
  "from-[#bcd3ea] to-[#4d7fb3]",
  "from-[#e7d6c5] to-[#8c6b4f]",
  "from-[#cfe6c2] to-[#5d9446]",
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -left-6 top-10 hidden rotate-[-6deg] rounded-2xl bg-card p-3 shadow-lift sm:block">
        <div className="grid size-24 grid-cols-5 gap-0.5 rounded-lg bg-white p-1.5" aria-hidden>
          {Array.from({ length: 25 }, (_, i) => (
            <span key={i} className={[0, 1, 5, 6, 3, 4, 8, 9, 15, 16, 20, 21, 12, 18, 23].includes(i) ? "rounded-[2px] bg-ink" : ""} />
          ))}
        </div>
        <div className="mt-2 text-center text-[11px] font-semibold">Scan to share</div>
      </div>
      <div className="ml-auto w-64 rounded-[2.2rem] border-[6px] border-ink bg-background p-3 shadow-lift sm:w-72">
        <div className="rounded-2xl bg-card p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">Sat, 14 Dec</div>
          <div className="text-base font-bold">Aina &amp; Hakim</div>
          <div className="mt-3 h-9 rounded-full bg-brand text-center text-sm font-semibold leading-9 text-white">Add photos</div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {TILES.map((t, i) => (
            <div key={i} className={`aspect-square rounded-lg bg-gradient-to-br ${t}`} />
          ))}
        </div>
        <div className="mt-2 text-center text-[11px] text-muted-foreground">1,284 photos from 146 guests</div>
      </div>
    </div>
  );
}
