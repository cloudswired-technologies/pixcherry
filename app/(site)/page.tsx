import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Check, ChevronDown, ImagePlus, Link2, MessageCircleHeart, Play, QrCode, Users, Volume2 } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { PlanCard } from "@/components/plan-card";
import { DeskShot, PhoneShot, type ShotTone } from "@/components/shot-frame";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { cn, LinkButton } from "@/components/ui";
import { APP_URL } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { listAddons, listPlans } from "@/lib/plans";
import { OG_IMAGE, ORG_ID, SITE_DESCRIPTION, SITE_ID, SITE_NAME } from "@/lib/seo";

// Landing page. Every image is a screenshot of the real app with real event photos, and the
// promo videos come from the Remotion project (D:\SYSTEM DEVELOPMENT\pixcherry-video), both
// prepared by scripts/landing-v2-assets.mjs. Every number comes from the live packages.

export const dynamic = "force-dynamic";

// Search: nobody local ranks for these yet (Oct 2026: page one is Kululu, Wedibox, GuestCam,
// POV), so the title leads with what people type plus "Malaysia".
export const metadata: Metadata = {
  title: { absolute: "QR Code Photo Sharing for Weddings & Events in Malaysia | PixCherry" },
  description: SITE_DESCRIPTION,
  keywords: [
    "QR code photo sharing",
    "wedding photo sharing app",
    "collect photos from wedding guests",
    "event photo sharing Malaysia",
    "guest photo album QR code",
    "live photo slideshow",
    "disposable camera app",
    "kongsi gambar majlis kahwin",
    "album gambar perkahwinan",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Every photo your guests take, in one live album",
    description: "Guests scan a QR code and snap. No app, no sign-up. Photos land in one shared album and on the big screen within seconds.",
    url: "/",
    images: [OG_IMAGE],
  },
};

const V = "/landing/v2";
const H2 = "text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] text-ink sm:text-5xl";
const LEAD = "mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground";

const OCCASIONS = ["Weddings", "Engagements", "Aqiqah", "Raya open houses", "Convocations", "Birthdays", "Family days", "Annual dinners", "Conferences", "Reunions"];

// The problem, the way it really goes in a family group chat.
const CHAT = [
  { from: "Kak Long", tone: "text-brand", text: "Sape ada gambar masa akad tadi? Send sini 🙏" },
  { from: "Hafiz", tone: "text-ok", text: "Nanti aku send k" },
  { from: "Mira", tone: "text-warn", text: "Esok la, phone aku penuh 😅" },
];

const STEPS = [
  {
    img: `${V}/host-overview-phone.webp`,
    alt: "The host page of a wedding album, with the QR card and slideshow ready",
    title: "Create your event",
    text: "Add a name, a date and a cover photo. Your QR card and slideshow are ready straight away.",
  },
  {
    img: `${V}/join-sheet.webp`,
    alt: "A guest joining an album with just their name",
    tone: "dim" as const,
    title: "Guests scan and join",
    text: "The album opens in their phone’s browser. They type a name and they’re in. No app, no password.",
  },
  {
    img: `${V}/raya-after-share.webp`,
    alt: "A Raya album with a photo that was just shared",
    title: "Photos land live",
    text: "Every shot shows up in the album, on every phone and on the big screen, within seconds.",
  },
];

const SCREEN_POINTS = [
  { icon: ImagePlus, text: "New photos pop up as they’re shared, with the name of who took them." },
  { icon: MessageCircleHeart, text: "Guests’ wishes scroll along the bottom of the screen." },
  { icon: QrCode, text: "The QR code stays in the corner, so late arrivals can join too." },
];

const LOOKS = ["Natural", "Disposable", "Kodak Gold", "Fuji 400", "Cinematic", "Polaroid"];

const PRIVACY = [
  { icon: Link2, title: "Only your guests can see it", text: "Albums open only with your link or QR code, and never show up in search engines." },
  { icon: CalendarClock, title: "Deleted on schedule", text: "Photos are erased after your storage period. We remind you first, so you can download everything." },
  { icon: BadgeCheck, title: "No ads, no tracking", text: "Your photos are never sold or used for ads. We follow Malaysia’s PDPA." },
];

const EVENTS = [
  { img: `${V}/wedding-home.webp`, label: "Wedding" },
  { img: `${V}/raya-home.webp`, label: "Raya open house" },
  { img: `${V}/convocation-home.webp`, label: "Convocation" },
  { img: `${V}/birthday-home.webp`, label: "Birthday party" },
];

const FAQ: [string, string][] = [
  [
    "How do I collect photos from my wedding guests?",
    "Put your PixCherry QR code on the tables, the welcome board or the big screen. Guests scan it, type their name and snap or upload, and every photo lands in one album in full quality. Afterwards you download everything as one ZIP, with a folder for each guest. No group chats or Drive links to chase.",
  ],
  [
    "Why not just use a WhatsApp group or Google Drive?",
    "WhatsApp shrinks photos and buries them in the chat, and uploading to a Drive folder needs a Google account and a link people lose. PixCherry needs no app or account, keeps photos sharp (up to 3072 pixels), shows them live on the big screen, and keeps every guest's photos in one album.",
  ],
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

function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 grid gap-3">
      {items.map((p) => (
        <li key={p} className="flex gap-3 text-muted-foreground">
          <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

// Hero artwork: one guest snaps and shares, and the same photo is already in a friend's album.
function HeroStage() {
  return (
    <div className="relative isolate mx-auto w-full max-w-[34rem] pt-[19%] motion-safe:animate-[pc-rise_0.8s_cubic-bezier(0.2,0.8,0.2,1)_0.15s_both]">
      <div aria-hidden className="absolute inset-x-0 bottom-0 top-[30%] -z-10 overflow-hidden rounded-[2.5rem] bg-[radial-gradient(90%_80%_at_70%_10%,#ffd0da,var(--brand-soft)_55%,#fff4f6)]">
        <div className="grain absolute inset-0 opacity-[0.07] mix-blend-multiply" />
      </div>
      <div className="flex items-start justify-center gap-[6%] px-[3%] pb-[7%]">
        <PhoneShot
          src={`${V}/wedding-develop-gold.webp`}
          alt="A guest's phone: a photo just taken at a wedding, with the Kodak Gold look, ready to share"
          className="w-[44%] -rotate-[4deg]"
          tone="dark"
          priority
        />
        <div className="relative mt-[12%] w-[44%] rotate-[3deg]">
          <PhoneShot src={`${V}/wedding-b-after.webp`} alt="Another guest's phone: the same photo is already in the shared album" priority />
          <span className="absolute -right-3 top-[17%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-lift">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-ok opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            Live
          </span>
        </div>
      </div>
      <svg aria-hidden viewBox="0 0 120 60" className="absolute left-[31%] top-[1%] w-[38%] text-brand">
        <path d="M6 50C30 0 90 0 114 58" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M116 46 114 58 104 51" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p aria-hidden className="absolute -top-5 left-[36%] -rotate-[4deg] font-script text-2xl text-ink sm:-top-7 sm:text-3xl">
        in seconds
      </p>
    </div>
  );
}

// The problem: photos that never leave the group chat.
function ChatCard() {
  return (
    <figure className="reveal mx-auto w-full max-w-md">
      <div className="rotate-[1.5deg] rounded-[2rem] bg-white p-5 shadow-lift ring-1 ring-border sm:p-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-bold text-ink">Family group</p>
            <p className="text-xs text-muted-foreground">Kak Long, Hafiz, Mira and 45 others</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2.5 text-[15px] text-ink">
          {CHAT.map((m) => (
            <li key={m.text} className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
              <span className={cn("block text-xs font-bold", m.tone)}>{m.from}</span>
              {m.text}
            </li>
          ))}
          <li className="py-1 text-center">
            <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted-foreground">Two weeks later</span>
          </li>
          <li className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
            <span className="block text-xs font-bold text-brand">Kak Long</span>
            Takde sape send lagi ke? 😭
          </li>
        </ul>
      </div>
      <figcaption className="mt-5 -rotate-2 text-center font-script text-2xl text-ink/80">sound familiar?</figcaption>
    </figure>
  );
}

// A feature card with the screenshot peeking up from the bottom edge.
function Tile({ title, text, img, alt, className, wide, tone, children }: { title: string; text: string; img: string; alt: string; className?: string; wide?: boolean; tone?: ShotTone; children?: React.ReactNode }) {
  return (
    <article className={cn("reveal group flex flex-col overflow-hidden rounded-[2rem] bg-white ring-1 ring-border transition duration-300 hover:-translate-y-1 hover:shadow-lift", wide && "md:flex-row", className)}>
      <div className={cn("p-6 sm:p-8", wide && "md:w-1/2 md:self-center md:p-10")}>
        <h3 className="text-balance text-2xl font-bold tracking-tight text-ink">{title}</h3>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{text}</p>
        {children}
      </div>
      <div className="relative h-72 overflow-hidden bg-[radial-gradient(75%_65%_at_50%_100%,var(--brand-soft),transparent)] sm:h-80 md:h-auto md:flex-1">
        <PhoneShot
          src={img}
          alt={alt}
          tone={tone}
          className={cn("absolute left-1/2 w-[62%] max-w-[15rem] -translate-x-1/2 transition duration-500 group-hover:-translate-y-2", wide ? "top-8 md:top-12" : "top-2")}
        />
      </div>
    </article>
  );
}

export default async function Home() {
  const [plans, addons] = await Promise.all([listPlans(), listAddons()]);
  const paid = plans.filter((p) => p.price_cents > 0);
  const free = plans.find((p) => p.price_cents === 0);
  const from = paid.length ? Math.min(...paid.map((p) => p.price_cents)) : null;
  const prices = plans.map((p) => p.price_cents / 100);

  // Who we are, what the product is and costs (live packages), and the FAQ, for search engines.
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        url: APP_URL,
        logo: { "@type": "ImageObject", url: `${APP_URL}/apple-icon.png`, width: 180, height: 180 },
        email: "support@pixcherry.com",
        address: { "@type": "PostalAddress", addressRegion: "Johor", addressCountry: "MY" },
        parentOrganization: { "@type": "Organization", name: "Cloudswired Technologies", url: "https://cloudswired.com" },
      },
      { "@type": "WebSite", "@id": SITE_ID, url: APP_URL, name: SITE_NAME, inLanguage: "en-MY", publisher: { "@id": ORG_ID } },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: APP_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any web browser on iPhone or Android",
        areaServed: { "@type": "Country", name: "Malaysia" },
        image: `${APP_URL}${OG_IMAGE.url}`,
        publisher: { "@id": ORG_ID },
        ...(plans.length
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "MYR",
                lowPrice: Math.min(...prices),
                highPrice: Math.max(...prices),
                offerCount: plans.length,
                offers: plans.map((p) => ({ "@type": "Offer", name: p.name, price: p.price_cents / 100, priceCurrency: "MYR", url: `${APP_URL}/#pricing` })),
              },
            }
          : {}),
      },
      { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };

  return (
    <>
      <JsonLd data={ld} />
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative isolate">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_85%_10%,rgb(233_29_72/0.09),transparent_70%),radial-gradient(45%_50%_at_0%_100%,var(--brand-soft),transparent_70%)]"
          />
          <div className="container-page grid items-center gap-14 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:pb-24">
            <div className="motion-safe:animate-[pc-rise_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both]">
              {/* The h1 names what people search for; the big line under it is the promise. */}
              <h1 className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
                <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                QR code photo sharing for weddings & events in Malaysia
              </h1>
              <p className="mt-5 text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[4rem]">
                Every photo your guests take, in one live album.
              </p>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Guests scan a QR code and snap away. No app, no sign-up. Every photo lands in one shared album, on everyone’s phone and on the big screen, within seconds
                and in full quality.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton href="/dashboard/events/new" variant="brand" size="lg" className="shadow-cherry">
                  Create your event <ArrowRight aria-hidden />
                </LinkButton>
                <LinkButton href="/demo" variant="outline" size="lg">
                  Try a live demo
                </LinkButton>
              </div>
              <a href="#video" className="group mt-6 inline-flex items-center gap-3 text-sm font-semibold text-ink transition hover:text-brand">
                <span className="grid size-9 place-items-center rounded-full bg-white text-brand shadow-soft ring-1 ring-border transition group-hover:scale-105">
                  <Play className="ml-0.5 size-3.5 fill-current" aria-hidden />
                </span>
                Watch the 50-second video
              </a>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-ok" aria-hidden />
                  {free ? `Free for up to ${free.limits.max_guests} guests` : "Free to start"}
                </li>
                {from !== null ? (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-ok" aria-hidden />
                    Paid packages from {formatMoney(from)} per event
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-ok" aria-hidden />
                  Pay once, no subscription
                </li>
              </ul>
            </div>
            <HeroStage />
          </div>
        </section>

        {/* ------------------------------------------------------------ occasions */}
        <div className="border-y border-border bg-white/70 py-4">
          <p className="sr-only">Made for {OCCASIONS.join(", ").toLowerCase()}.</p>
          <div aria-hidden className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max animate-[pc-ticker_50s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
              {[0, 1].map((k) => (
                <ul key={k} className="flex shrink-0 items-center">
                  {OCCASIONS.map((o) => (
                    <li key={o} className="flex items-center gap-6 pr-6 text-lg font-semibold text-ink/70">
                      {o}
                      <span className="size-1.5 rounded-full bg-brand" />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ problem */}
        <section className="py-16 sm:py-28">
          <div className="container-page grid items-center gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div className="reveal">
              <h2 className={H2}>Your guests take hundreds of photos. Most of them never reach you.</h2>
              <p className={LEAD}>
                They stay in phones, get squashed in group chats, or never get sent at all. PixCherry collects them while the party is still going, in full quality, and nobody has
                to chase anyone.
              </p>
              <ul className="mt-8 grid gap-x-6 gap-y-3 font-medium text-ink sm:grid-cols-2">
                {["One album for every guest’s photos", "Full quality, sharp enough to print", "Live on the big screen while you party", "One ZIP to download, a folder per guest"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <ChatCard />
          </div>
        </section>

        {/* ------------------------------------------------------------ how */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-24">
          <div className="container-page">
            <div className="reveal flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <h2 className={H2}>Ready in minutes. Your guests do the rest.</h2>
                <p className={LEAD}>One QR code is all it takes. Guests share photos straight from their phone’s browser, with no app to download and no account to make.</p>
              </div>
              <Link href="/guide" className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">
                Read the step-by-step guide <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className={cn("reveal grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-6 md:block", i === 1 && "md:mt-12", i === 2 && "md:mt-24")}>
                  <PhoneShot src={s.img} alt={s.alt} tone={s.tone} className="w-full md:max-w-[15rem]" />
                  <div className="md:mt-8">
                    <span className="grid size-10 place-items-center rounded-full bg-brand text-lg font-extrabold text-white shadow-cherry">{i + 1}</span>
                    <h3 className="mt-4 text-xl font-bold text-ink">{s.title}</h3>
                    <p className="mt-2 text-pretty text-muted-foreground">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ big screen */}
        <section className="py-16 sm:py-28">
          <div className="container-page">
            <div className="reveal mx-auto max-w-2xl text-center">
              <h2 className={H2}>A live photo slideshow for the big screen</h2>
              <p className={cn(LEAD, "mx-auto")}>Open the slideshow on any TV or projector. Guests watch their photos go up, and the whole party joins in.</p>
            </div>
            <div className="reveal relative mx-auto mt-12 max-w-5xl md:pb-14 md:pr-28">
              <figure>
                <div className="rounded-[1.6rem] bg-ink p-2 shadow-lift sm:p-3">
                  <img
                    src={`${V}/slideshow-wedding.webp`}
                    alt="A wedding album on the live slideshow, with the QR code to join"
                    width={1600}
                    height={900}
                    loading="lazy"
                    className="block aspect-[16/9] w-full rounded-[1.1rem] object-cover"
                  />
                </div>
                <div aria-hidden className="mx-auto h-5 w-24 bg-ink/90 [clip-path:polygon(22%_0,78%_0,100%_100%,0_100%)] sm:h-7 sm:w-36" />
              </figure>
              <figure className="absolute bottom-0 right-0 hidden w-[36%] rotate-2 md:block">
                <div className="rounded-2xl bg-ink p-1.5 shadow-lift">
                  <img
                    src={`${V}/slideshow-conference.webp`}
                    alt="A conference album on the live slideshow"
                    width={1600}
                    height={900}
                    loading="lazy"
                    className="block aspect-[16/9] w-full rounded-xl object-cover"
                  />
                </div>
                <figcaption className="mt-2 text-center font-script text-2xl text-ink">conferences too</figcaption>
              </figure>
            </div>
            <ul className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
              {SCREEN_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="reveal flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="pt-1 text-pretty text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ video */}
        <section id="video" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-24">
          <div className="container-page grid items-center gap-10 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-14">
            <div className="reveal">
              <h2 className={H2}>See it in 50 seconds</h2>
              <p className={LEAD}>From the QR code on the table to photos on every phone and the big screen.</p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-sm font-semibold text-brand-strong">
                <Volume2 className="size-4" aria-hidden />
                In Bahasa Melayu, sound on
              </p>
            </div>
            <div className="reveal relative isolate">
              <div aria-hidden className="absolute -inset-8 -z-10 bg-[radial-gradient(60%_60%_at_50%_50%,rgb(233_29_72/0.16),transparent_70%)]" />
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

        {/* ------------------------------------------------------------ features */}
        <section id="features" className="scroll-mt-20 py-16 sm:py-28">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <h2 className={H2}>Guests share more when it’s fun</h2>
              <p className={LEAD}>A shared folder gets a handful of uploads. A film camera, a few challenges and a leaderboard keep people snapping all night.</p>
            </div>
            <div className="mt-12 grid gap-5 md:auto-rows-[27rem] md:grid-cols-2 lg:grid-cols-6">
              <Tile
                wide
                className="md:col-span-2 lg:col-span-4"
                title="A disposable camera in every phone"
                text="Guests snap, pick a look and share in one tap. Twelve film looks, from Kodak Gold to Polaroid."
                img={`${V}/develop-polaroid.webp`}
                alt="The PixCherry camera with the Polaroid look"
                tone="dark"
              >
                <ul className="mt-5 flex flex-wrap gap-2">
                  {LOOKS.map((l) => (
                    <li key={l} className="rounded-lg bg-canvas px-2.5 py-1 text-xs font-semibold text-ink/80">
                      {l}
                    </li>
                  ))}
                  <li className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">+6 more</li>
                </ul>
              </Tile>
              <Tile
                className="lg:col-span-2"
                title="Snap missions"
                text="Little challenges like “Selfie with the pengantin” that guests race to finish."
                img={`${V}/familyday-missions.webp`}
                alt="Snap missions at a family day"
              />
              <Tile
                className="lg:col-span-2"
                title="The best shots rise to the top"
                text="Hearts push the most-loved photos into Highlights, next to a top-snappers leaderboard."
                img={`${V}/wedding-highlights.webp`}
                alt="Highlights with the most loved photos of a wedding"
              />
              <Tile
                className="lg:col-span-2"
                title="A wall of wishes"
                text="Guests leave kind words next to the photos, and the wishes scroll on the big screen too."
                img={`${V}/wedding-wishes.webp`}
                alt="The wishes wall of a wedding album"
              />
              <Tile
                className="lg:col-span-2"
                title="Full quality, ready to print"
                text="Up to 3072 pixels on the long side. Tap any photo to zoom in, heart it or save it."
                img={`${V}/wedding-viewer.webp`}
                alt="A wedding photo open in the viewer, with hashtags and hearts"
                tone="dark"
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ host */}
        <section className="border-y border-border bg-white py-16 sm:py-24">
          <div className="container-page grid items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="reveal">
              <p className="text-sm font-semibold text-brand">For the host</p>
              <h2 className={cn(H2, "mt-2")}>You stay in control, start to finish</h2>
              <p className={LEAD}>Watch the album fill up from your phone or laptop, keep it clean, and take everything home.</p>
              <Points
                items={[
                  "Photos, guests and wishes update live on your dashboard.",
                  "Every photo is checked automatically. Anything that looks like nudity waits for you, or you can approve every photo first.",
                  "Remove a photo or block a guest in one tap.",
                  "Download the whole album as one ZIP with a folder per guest, or only the photos you tick.",
                ]}
              />
            </div>
            <div className="reveal relative pb-10 sm:pb-14">
              <DeskShot src={`${V}/host-overview.webp`} alt="The host dashboard for a wedding album" className="sm:mr-[12%]" />
              <PhoneShot src={`${V}/host-photos-phone.webp`} alt="The host's photo list on a phone" className="absolute -bottom-2 right-0 w-[30%] max-w-[12rem]" />
            </div>
          </div>
          <div className="container-page mt-16 sm:mt-20">
            <h3 className="text-xl font-bold text-ink">Private by default</h3>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {PRIVACY.map(({ icon: Icon, title, text }) => (
                <li key={title} className="reveal rounded-3xl bg-canvas p-6">
                  <span className="grid size-11 place-items-center rounded-2xl bg-white text-brand shadow-soft">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 font-bold text-ink">{title}</p>
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ demo albums */}
        <section className="py-16 sm:py-28">
          <div className="container-page">
            <div className="reveal flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className={H2}>Try it before your event</h2>
                <p className={LEAD}>Open a demo album, join with any name and snap a photo yourself. Photos from visitors clear after 24 hours.</p>
              </div>
              <LinkButton href="/demo" variant="outline" size="lg">
                All demo albums <ArrowRight aria-hidden />
              </LinkButton>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
              {EVENTS.map((e, i) => (
                <Link key={e.label} href="/demo" className={cn("reveal group block", i % 2 === 1 && "lg:mt-10")}>
                  <PhoneShot
                    src={e.img}
                    alt={`The demo ${e.label.toLowerCase()} album`}
                    className="mx-auto w-full max-w-[14rem] transition duration-300 group-hover:-translate-y-1.5"
                  />
                  <span className="mt-4 flex items-center justify-center gap-1.5 font-semibold text-ink transition group-hover:text-brand">
                    {e.label}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-24">
          <div className="container-page">
            <div className="reveal max-w-2xl">
              <h2 className={H2}>Pay once per event. No subscription.</h2>
              <p className={LEAD}>Start free, or pick the package that fits your guest list. Pay with FPX online banking, and upgrade or add more before or during the event.</p>
            </div>
            <div className={cn("mt-12 grid gap-8", plans.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "lg:grid-cols-3")}>
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
        <section id="faq" className="scroll-mt-20 py-16 sm:py-24">
          <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className={H2}>Questions people ask</h2>
              <p className="mt-4 text-muted-foreground">
                Something else? Email{" "}
                <a href="mailto:support@pixcherry.com" className="font-semibold text-ink underline underline-offset-4">
                  support@pixcherry.com
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink transition hover:text-brand">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="pb-20 sm:pb-28">
          <div className="container-page">
            <div className="reveal relative isolate grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-brand-strong px-6 py-14 text-white shadow-cherry sm:px-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_90%_0%,rgb(255_120_150/0.45),transparent_60%),radial-gradient(60%_70%_at_0%_100%,rgb(90_0_25/0.35),transparent_60%)]"
              />
              <div aria-hidden className="grain absolute inset-0 -z-10 opacity-[0.08] mix-blend-overlay" />
              <div>
                <h2 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-5xl">Your guests are already taking the photos.</h2>
                <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-white">Give them one place to put them. Set up your album in minutes, free for small events.</p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link
                    href="/dashboard/events/new"
                    className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 font-semibold text-brand-strong shadow-lift transition hover:bg-brand-soft active:scale-[0.98]"
                  >
                    Create your event <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href="/demo" className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline">
                    Try a live demo <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
              <img
                src={`${V}/qr-card.webp`}
                alt="The QR card guests scan"
                width={640}
                height={896}
                loading="lazy"
                className="mx-auto w-full max-w-[15rem] rotate-3 rounded-2xl shadow-[0_30px_60px_rgb(60_0_15/0.45)]"
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
