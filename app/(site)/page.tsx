import Link from "next/link";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { PlanCard } from "@/components/plan-card";
import { DeskShot, PhoneShot } from "@/components/shot-frame";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listAddons, listPlans } from "@/lib/plans";

// Landing page. Every image is a screenshot of the real app with real event photos, and the
// promo videos come from the Remotion project (D:\SYSTEM DEVELOPMENT\pixcherry-video), both
// prepared by scripts/landing-v2-assets.mjs. Every number comes from the live packages.

export const dynamic = "force-dynamic";

const V = "/landing/v2";

const STEPS = [
  { title: "Put out the QR code", text: "Print the card or show it on a screen. It tells guests exactly what to do." },
  { img: `${V}/wedding-develop-gold.webp`, title: "Guests scan and snap", text: "The album opens in their phone's browser. A name, one tap, and they're shooting." },
  { img: `${V}/wedding-all.webp`, title: "Everyone sees it, live", text: "Each photo lands in the shared album, and on the big screen, within seconds." },
];

const EVENTS = [
  { img: `${V}/wedding-home.webp`, label: "Weddings" },
  { img: `${V}/raya-home.webp`, label: "Raya open houses" },
  { img: `${V}/convocation-home.webp`, label: "Convocations" },
  { img: `${V}/birthday-home.webp`, label: "Birthdays" },
];

const FAQ: [string, string][] = [
  ["Do guests need to download an app or make an account?", "No. They scan the QR code and the album opens in the phone's browser. They type their name (a selfie is optional) and start sharing."],
  ["Does it work on iPhone and Android?", "Yes, in the normal browser on both. iPhone photos (HEIC) are converted automatically."],
  ["What happens to photo quality?", "Photos are kept sharp: up to 3072 pixels on the long side, which is enough to print. They're shrunk a little on the phone first, so they upload quickly even on busy venue Wi-Fi."],
  ["How long are the photos kept?", "That depends on the package. Your event page shows the exact deletion date. We email you before it happens, you can download everything at any time, and you can add more days if you need them."],
  ["Can I download all the photos?", "Yes. The whole album downloads as one ZIP with a folder for each guest, or you can tick just the photos you want. Every guest can save single photos to their phone."],
  ["What if someone uploads something inappropriate?", "Every photo is checked automatically, and anything that looks like nudity is hidden until you look at it. Guests can report a photo; after two reports it's hidden for you to check. You can delete any photo, block a guest, or approve every photo before it shows."],
  ["Who can see the album?", "Only people with the link or QR code. Albums aren't listed anywhere or shown in search engines."],
  ["Can I use it for a corporate event, a school event or a family day?", "Yes. Missions, hashtags and the slideshow work for any event, and you choose your own wording."],
  ["Can guests still upload after the event?", "Yes, for a while: each package keeps uploads open for some hours after the event ends, so late photos still make it in."],
  ["How do I pay?", "Once per event, online with FPX (online banking) through CHIP. There's no subscription, and the Free package costs nothing."],
  ["When can guests start sharing?", "From the event's start time. Before that, anyone who scans the QR code sees the event with a countdown, so they know the album is ready. You, the host, can preview it any time."],
  ["Can I change the event details or the link later?", "Yes. The name, message, venue and link can change any time, and old QR codes keep working. The date and time can change until the event starts; after that they're fixed."],
];

function Points({ items, light }: { items: string[]; light?: boolean }) {
  return (
    <ul className="mt-5 grid gap-3">
      {items.map((p) => (
        <li key={p} className={`flex gap-3 ${light ? "text-white/80" : "text-muted-foreground"}`}>
          <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

function Feature({ eyebrow, title, intro, points, children, flip }: { eyebrow: string; title: string; intro: string; points: string[]; children: React.ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <p className="text-sm font-bold uppercase tracking-wider text-brand">{eyebrow}</p>
        <h3 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-3 text-lg text-muted-foreground">{intro}</p>
        <Points items={points} />
      </div>
      <div className={flip ? "md:order-1" : ""}>{children}</div>
    </div>
  );
}

export default async function Home() {
  const [plans, addons] = await Promise.all([listPlans(), listAddons()]);
  const paid = plans.filter((p) => p.price_cents > 0);
  const free = plans.find((p) => p.price_cents === 0);
  const from = paid.length ? Math.min(...paid.map((p) => p.price_cents)) : null;

  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* ------------------------------------------------------------ hero */}
        <section className="container-page grid items-center gap-14 pb-20 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">For weddings, Raya, convos and every party</p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">Every photo your guests take. In one album, live.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Guests scan a QR code and snap. No app, no sign-up. Their photos land in one shared album and on the big screen within seconds, in full quality. You go home
              with every moment, not just the posed ones.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard/events/new" variant="brand" size="lg" className="shadow-cherry">
                Create your event <ArrowRight aria-hidden />
              </LinkButton>
              <LinkButton href="/demo" variant="outline" size="lg">
                Try a live demo
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {free ? `Free for up to ${free.limits.max_guests} guests · ` : ""}
              {from !== null ? `paid packages from ${formatMoney(from)} per event · ` : ""}
              pay once, no subscription
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-2xl pb-12">
            <img
              src={`${V}/slideshow-wedding.webp`}
              alt="A wedding album on the live slideshow, with the QR code to join"
              width={1600}
              height={900}
              className="w-full rounded-2xl shadow-lift"
              fetchPriority="high"
            />
            <PhoneShot src={`${V}/wedding-home.webp`} alt="The same wedding album on a guest's phone" className="absolute -bottom-2 -left-3 w-[34%] sm:-left-8" priority />
            <p className="absolute -bottom-3 right-0 rotate-[-3deg] font-script text-2xl text-ink sm:text-3xl">snapped, then on the TV</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ video */}
        <section id="video" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-20">
          <div className="container-page grid items-center gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight">See it in 50 seconds</h2>
              <p className="mt-3 text-lg text-muted-foreground">From the QR code on the table to photos on every phone and the big screen. Turn the sound on.</p>
              <p className="mt-4 text-sm font-semibold text-muted-foreground">Video in Bahasa Melayu.</p>
            </div>
            <div>
              {/* One video per screen shape; preload="none" so only the one you play downloads. */}
              <video
                className="mx-auto w-full max-w-sm rounded-3xl bg-ink shadow-lift md:hidden"
                controls
                playsInline
                preload="none"
                poster={`${V}/promo-9x16-poster.webp`}
                width={720}
                height={1280}
              >
                <source src={`${V}/promo-9x16.mp4`} type="video/mp4" />
              </video>
              <video
                className="hidden w-full rounded-2xl bg-ink shadow-lift md:block"
                controls
                playsInline
                preload="none"
                poster={`${V}/promo-16x9-poster.webp`}
                width={1280}
                height={720}
              >
                <source src={`${V}/promo-16x9.mp4`} type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ problem / outcome */}
        <section className="py-16 sm:py-24">
          <div className="container-page">
            <h2 className="max-w-3xl text-4xl font-extrabold tracking-tight">Your guests take hundreds of photos. Most of them never reach you.</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              The best moments are the candid ones, and they&apos;re sitting in your guests&apos; phones. PixCherry collects them while the party is still going.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-white p-6 sm:p-8">
                <h3 className="text-xl font-bold">Without PixCherry</h3>
                <ul className="mt-5 grid gap-3">
                  {[
                    "Photos stay in dozens of phones, or get lost in WhatsApp groups.",
                    "What does arrive is compressed and blurry.",
                    "You spend weeks asking people to send them.",
                    "The funniest, most honest moments are never seen.",
                  ].map((t) => (
                    <li key={t} className="flex gap-3 text-muted-foreground">
                      <X className="mt-0.5 size-5 shrink-0 text-muted-foreground/70" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-ink p-6 text-white sm:p-8">
                <h3 className="text-xl font-bold">With PixCherry</h3>
                <Points
                  light
                  items={[
                    "One album for everyone, filling up as the event happens.",
                    "Full-quality photos, sharp enough to print.",
                    "Live on the big screen, so guests keep snapping.",
                    "Everything downloads in one ZIP, a folder per guest.",
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ how */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-20">
          <div className="container-page">
            <h2 className="max-w-xl text-4xl font-extrabold tracking-tight">Set up in minutes. Your guests do the rest.</h2>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  {s.img ? (
                    <PhoneShot src={s.img} alt="" className="mx-auto w-full max-w-[14rem]" />
                  ) : (
                    <div className="mx-auto grid aspect-[390/844] w-full max-w-[14rem] place-items-center rounded-[2.2rem] bg-canvas p-5">
                      <img src={`${V}/qr-card.webp`} alt="The printed QR card" width={640} height={896} loading="lazy" className="w-full rotate-[-3deg] rounded-xl shadow-lift" />
                    </div>
                  )}
                  <p className="mt-6 text-sm font-bold text-brand">Step {i + 1}</p>
                  <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
                  <p className="mt-1 text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-muted-foreground">
              Want every detail?{" "}
              <Link href="/guide" className="font-semibold text-brand underline-offset-4 hover:underline">
                Read the step-by-step guide
              </Link>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ value */}
        <section id="features" className="scroll-mt-20 py-16 sm:py-24">
          <div className="container-page grid gap-24 sm:gap-32">
            <Feature
              eyebrow="More photos"
              title="Guests share more, because it's fun"
              intro="A shared folder gets a handful of uploads. A camera, a few challenges and a leaderboard keep people snapping all night."
              points={[
                "A film camera in every phone, with 12 looks from Kodak Gold to Polaroid.",
                "Snap missions like “Selfie with the host” that guests race to finish.",
                "Hearts on favourite photos and a top-snappers leaderboard.",
              ]}
            >
              <div className="flex items-start justify-center gap-4">
                <PhoneShot src={`${V}/develop-polaroid.webp`} alt="The film camera with the Polaroid look" className="w-[46%] max-w-[15rem]" />
                <PhoneShot src={`${V}/familyday-missions.webp`} alt="Snap missions at a family day" className="mt-12 w-[46%] max-w-[15rem]" />
              </div>
            </Feature>

            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-brand">The big screen</p>
              <h3 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Turn the screen into part of the party</h3>
              <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
                Open the slideshow on a TV or projector. New photos pop up as they&apos;re shared, with who took them, wishes scroll past, and the QR code in the corner brings more
                guests in.
              </p>
              <img src={`${V}/slideshow-conference.webp`} alt="A conference album on the live slideshow" width={1600} height={900} loading="lazy" className="mt-8 w-full rounded-2xl shadow-lift" />
            </div>

            <Feature
              flip
              eyebrow="No sorting"
              title="An album that organises itself"
              intro="No more scrolling through hundreds of photos to find the good ones."
              points={[
                "Highlights pulls out the most loved photos.",
                "Hashtags like #akadnikah or #dancefloor become their own albums.",
                "Every guest gets a folder of their own photos.",
                "A wishes wall keeps everyone's kind words with the photos.",
              ]}
            >
              <div className="flex items-start justify-center gap-4">
                <PhoneShot src={`${V}/wedding-highlights.webp`} alt="Highlights with the most loved photos" className="w-[46%] max-w-[15rem]" />
                <PhoneShot src={`${V}/wedding-wishes.webp`} alt="The wishes wall" className="mt-12 w-[46%] max-w-[15rem]" />
              </div>
            </Feature>

            <Feature
              eyebrow="For the host"
              title="You stay in control"
              intro="See everything as it comes in, from your phone or laptop."
              points={[
                "Photos, guests and wishes update live on your dashboard.",
                "Every photo is checked automatically. Anything that looks like nudity waits for you, or you can approve every photo first.",
                "Remove a photo or block a guest in one tap.",
                "Download the whole album, or only the photos you pick.",
              ]}
            >
              <DeskShot src={`${V}/host-overview.webp`} alt="The host dashboard for a wedding album" />
            </Feature>

            <div className="grid items-center gap-8 rounded-3xl bg-canvas p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-brand">Private by default</p>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight">Your memories stay yours</h3>
              </div>
              <Points
                items={[
                  "Only people with your link or QR code can see the album. It never shows up in search engines.",
                  "Photos are deleted automatically after your storage period. We remind you first.",
                  "No ads and no tracking. We follow Malaysia's PDPA.",
                ]}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ events */}
        <section className="border-y border-border bg-white py-16 sm:py-20">
          <div className="container-page">
            <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight">Made for every kind of gathering</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              Weddings, aqiqah, Raya open houses, convocations, birthdays, family days, company dinners and conferences. Wherever people take photos, they can share them in one album.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-5 sm:gap-8 lg:grid-cols-4">
              {EVENTS.map((e) => (
                <figure key={e.label}>
                  <PhoneShot src={e.img} alt={`A ${e.label.toLowerCase()} album`} className="mx-auto w-full max-w-[14rem]" />
                  <figcaption className="mt-4 text-center font-semibold">{e.label}</figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <LinkButton href="/demo" variant="outline" size="lg">
                Open a live demo album <ArrowRight aria-hidden />
              </LinkButton>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ pricing */}
        <section id="pricing" className="scroll-mt-20 py-16 sm:py-20">
          <div className="container-page">
            <h2 className="text-4xl font-extrabold tracking-tight">Pay once per event. No subscription.</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Start free, or pick the package that fits your guest list. You can upgrade or add more before or during the event.</p>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  action={
                    <LinkButton href={`/dashboard/events/new?plan=${p.code}`} variant={p.is_featured ? "brand" : "primary"} size="lg" className="w-full">
                      {p.price_cents === 0 ? "Start free" : `Choose ${p.name}`} <ArrowRight aria-hidden />
                    </LinkButton>
                  }
                />
              ))}
            </div>
            {addons.length ? (
              <p className="mt-8 text-sm text-muted-foreground">
                Need a bit more? Add {addons.map((a) => `${a.name.toLowerCase()} (${formatMoney(a.price_cents)})`).join(", ")} to any paid event.
              </p>
            ) : null}
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section id="faq" className="scroll-mt-20 border-t border-border bg-white py-16 sm:py-20">
          <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight">Questions people ask</h2>
              <p className="mt-3 text-muted-foreground">
                Something else? Email{" "}
                <a href="mailto:support@pixcherry.com" className="font-semibold text-ink underline underline-offset-4">
                  support@pixcherry.com
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-2 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="py-16">
          <div className="container-page">
            <div className="grid items-center gap-8 rounded-3xl bg-ink px-6 py-12 text-white sm:px-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight">Your guests are already taking the photos</h2>
                <p className="mt-3 max-w-lg text-lg text-white/75">Give them one place to put them. Set up your album in minutes, free for small events.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <LinkButton href="/dashboard/events/new" variant="brand" size="lg">
                    Create your event <ArrowRight aria-hidden />
                  </LinkButton>
                  <LinkButton href="/demo" variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                    Try a live demo
                  </LinkButton>
                </div>
              </div>
              <img src={`${V}/qr-card.webp`} alt="The QR card guests scan" width={640} height={896} loading="lazy" className="mx-auto w-full max-w-[16rem] rotate-2 rounded-2xl shadow-lift" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
