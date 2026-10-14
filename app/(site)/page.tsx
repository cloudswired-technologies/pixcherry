import {
  ArrowRight,
  Baby,
  Briefcase,
  Camera,
  CalendarClock,
  ChevronDown,
  Download,
  GraduationCap,
  Heart,
  Images,
  Laptop,
  PartyPopper,
  QrCode,
  Smartphone,
  Target,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

const EVENTS = [
  { icon: Heart, title: "Weddings", text: "Nikah, sanding, reception — every angle from every guest.", tone: "from-[#ffe6eb] to-[#ffc2cf]" },
  { icon: PartyPopper, title: "Birthdays", text: "From first birthdays to surprise parties.", tone: "from-[#fff1d6] to-[#ffd38a]" },
  { icon: Briefcase, title: "Corporate events", text: "Launches, dinners and team days, captured by the team.", tone: "from-[#e3ecff] to-[#b8cbff]" },
  { icon: Baby, title: "Family gatherings", text: "Raya open house, aqiqah, reunions.", tone: "from-[#e5f7ec] to-[#b6e8c8]" },
  { icon: GraduationCap, title: "School events", text: "Sports day, graduation, prize giving.", tone: "from-[#f1e7ff] to-[#d4bdfc]" },
];

const STEPS = [
  { icon: Laptop, title: "Create your event", text: "Set up your event in minutes and get your unique QR code." },
  { icon: QrCode, title: "Share the QR code", text: "Print the QR card or show it on a screen at the venue." },
  { icon: Smartphone, title: "Guests snap & upload", text: "No app, no sign-up. Guests open the page and start sharing." },
  { icon: Images, title: "Enjoy every photo", text: "View, download and keep your best moments — all in one album." },
];

const FUN = [
  { icon: Camera, title: "Disposable camera", text: "A film camera in every guest's phone: 12 film looks, a shots-left counter and that satisfying click." },
  { icon: Target, title: "Snap missions", text: "\"Selfie with the couple\", \"Best dressed guest\"… guests tick off challenges you set." },
  { icon: Trophy, title: "Hearts & leaderboard", text: "Guests heart their favourites. See the most loved photos and the top snappers." },
  { icon: Tv, title: "Live slideshow", text: "Put the big screen to work: new photos pop up the moment they're shared, with wishes scrolling by." },
];

const FAQ = [
  ["Do guests need to download an app?", "No. They scan the QR code and the album opens in their phone's browser. No account needed."],
  ["How long are the photos kept?", "It depends on your package. You'll see the exact deletion date on your event page, we email you before it, and you can download everything or add more days any time."],
  ["Can I download all photos?", "Yes — the whole album as one ZIP, sorted into a folder for each guest, plus all the wishes."],
  ["Can I remove photos?", "Yes. You can delete any photo, block a guest, or turn on approval so photos only show after you approve them."],
  ["Is there a limit on photo uploads?", "Each package sets how many photos each guest can take. Guests always see how many shots they have left."],
  ["Can I use it for corporate events?", "Of course — PixCherry works for any event where people take photos."],
];

export default async function Home() {
  const plans = await listPlans();
  const from = plans.length ? Math.min(...plans.map((p) => p.price_cents)) : null;
  const days = plans.length ? Math.min(...plans.map((p) => p.limits.retention_days)) : 7;
  const FEATURES = [
    { icon: Camera, label: "Guests upload photos" },
    { icon: Images, label: "All photos in one gallery" },
    { icon: Download, label: "Download the full album" },
    { icon: CalendarClock, label: `Auto delete after ${days} days` },
  ];
  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative">
          <div className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-brand-soft blur-3xl" aria-hidden />
          <div className="container-page relative grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">All your moments in one place</p>
              <h1 className="mt-4 text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">Share your best moment</h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Let your guests capture and share their photos from any event. One QR code. All the memories in one place.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton href="/dashboard/events/new" variant="brand" size="lg" className="shadow-cherry">
                  Create your event <ArrowRight aria-hidden />
                </LinkButton>
                <LinkButton href="/#how" variant="outline" size="lg">
                  See how it works
                </LinkButton>
              </div>
              {from !== null ? <p className="mt-4 text-sm font-medium text-muted-foreground">From {formatMoney(from)} per event · no subscription</p> : null}
            </div>
            <div className="relative mx-auto h-[30rem] w-full max-w-md sm:h-[34rem]">
              <img src="/brand/screen-gallery.webp" alt="" className="absolute right-0 top-10 w-[46%] rotate-6 rounded-[1.6rem] shadow-lift" />
              <img src="/brand/screen-home.webp" alt="The PixCherry guest page for a wedding" className="absolute left-2 top-0 w-[58%] -rotate-3 rounded-[1.8rem] border-4 border-white shadow-lift" />
              <p className="absolute bottom-6 right-2 -rotate-6 font-script text-3xl leading-none text-ink sm:text-4xl">
                Every guest.
                <br />
                Every moment.
              </p>
              <span className="absolute bottom-0 right-6 h-1 w-28 -rotate-6 rounded-full bg-brand" aria-hidden />
            </div>
          </div>
          <div className="container-page grid grid-cols-2 gap-4 pb-16 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="grid justify-items-center gap-3 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
                  <f.icon className="size-7" aria-hidden />
                </span>
                <span className="max-w-[9rem] text-sm font-semibold">{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ events */}
        <section className="bg-white py-16">
          <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight">Perfect for any event</h2>
              <p className="mt-3 text-muted-foreground">From weddings to corporate events, PixCherry makes it easy for everyone to share and keep their best moments.</p>
            </div>
            <div className="grid gap-3">
              {EVENTS.map((e) => (
                <div key={e.title} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-3 shadow-soft">
                  <span className={`grid size-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${e.tone}`}>
                    <e.icon className="size-7 text-ink" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{e.title}</span>
                    <span className="block text-sm text-muted-foreground">{e.text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ how */}
        <section id="how" className="scroll-mt-20 py-16">
          <div className="container-page">
            <h2 className="text-4xl font-extrabold tracking-tight">How it works</h2>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Simple. Fun. For everyone.</p>
            <ol className="mt-10 grid gap-8 md:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative grid gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                  <s.icon className="size-10 text-ink" strokeWidth={1.5} aria-hidden />
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ gallery */}
        <section className="py-6">
          <div className="container-page">
            <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-brand-soft px-6 py-12 sm:px-12 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Event gallery</p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-tight">All photos in one place</h2>
                <p className="mt-3 text-muted-foreground">
                  From candid moments to unforgettable highlights, everything is neatly organised — by mission, by guest, by most loved — in a private and beautiful gallery.
                </p>
                <LinkButton href="/dashboard/events/new" variant="brand" size="lg" className="mt-6">
                  Start your album <ArrowRight aria-hidden />
                </LinkButton>
              </div>
              <div className="relative mx-auto flex h-[26rem] w-full max-w-md justify-center">
                <img src="/brand/screen-highlights.webp" alt="" className="absolute left-0 top-4 w-[44%] -rotate-6 rounded-[1.4rem] shadow-lift" />
                <img src="/brand/screen-person.webp" alt="" className="absolute right-0 top-4 w-[44%] rotate-6 rounded-[1.4rem] shadow-lift" />
                <img src="/brand/screen-viewer.webp" alt="Photo viewer" className="relative z-10 w-[48%] rounded-[1.6rem] border-4 border-white shadow-lift" />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ fun */}
        <section id="features" className="scroll-mt-20 py-16">
          <div className="container-page">
            <h2 className="text-4xl font-extrabold tracking-tight">More fun than a shared folder</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">Guests don&apos;t just upload — they play. That&apos;s why you get more photos, from more people.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FUN.map((f) => (
                <div key={f.title} className="rounded-3xl border border-border bg-white p-6 shadow-soft">
                  <span className="grid size-12 place-items-center rounded-2xl bg-ink text-white">
                    <f.icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ pricing */}
        <section id="pricing" className="scroll-mt-20 bg-white py-16">
          <div className="container-page">
            <h2 className="text-center text-4xl font-extrabold tracking-tight">Simple & transparent pricing</h2>
            <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Pay once per event · no subscription</p>
            <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  action={
                    <LinkButton href={`/dashboard/events/new?plan=${p.code}`} variant={p.is_featured ? "brand" : "primary"} size="lg" className="w-full">
                      Create your event <ArrowRight aria-hidden />
                    </LinkButton>
                  }
                />
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section id="faq" className="scroll-mt-20 py-16">
          <div className="container-page max-w-3xl">
            <h2 className="text-4xl font-extrabold tracking-tight">Frequently asked questions</h2>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="pb-16">
          <div className="container-page">
            <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-brand px-6 py-12 text-white sm:px-12 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight">Ready to capture more memories?</h2>
                <p className="mt-3 text-white/85">No complicated setup. Create your event, share the QR code and start collecting memories in minutes.</p>
                <LinkButton href="/dashboard/events/new" variant="outline" size="lg" className="mt-6 border-white bg-white text-brand hover:bg-white/90">
                  Create your event <ArrowRight aria-hidden />
                </LinkButton>
                <div className="mt-6 flex items-center gap-2 text-sm text-white/85">
                  <Users className="size-4" aria-hidden /> Works on every phone · no app needed
                </div>
              </div>
              <img src="/brand/qr-stand.webp" alt="A PixCherry QR stand at a wedding table" className="mx-auto w-full max-w-xs rotate-3 rounded-3xl shadow-lift" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
