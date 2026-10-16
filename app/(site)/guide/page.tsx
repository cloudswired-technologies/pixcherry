import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DeskShot, PhoneShot } from "@/components/shot-frame";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";

export const metadata = {
  title: "How to use PixCherry — step by step",
  description: "Set up your event album, share the QR code, and see how guests snap and share. A step-by-step guide for hosts and guests.",
};

type Step = { title: string; text: string[]; img: string; alt: string; kind: "phone" | "desk" };

const HOST: Step[] = [
  {
    title: "Create your event",
    text: [
      "Log in with your email (we send a 6-digit code, no password to remember).",
      "Type the event name, date and time, venue and a short message for guests. Pick a link people can read, like app.pixcherry.com/aina-hakim. Set the real start time: the album opens to guests then, and the dates are fixed once the event starts.",
    ],
    img: "/landing/guide-create.webp",
    alt: "Create event form with name, venue and message",
    kind: "desk",
  },
  {
    title: "Choose a package and pay once",
    text: [
      "Every package shows exactly what you get: how many guests, photos per guest, how long photos stay online, and which features are included.",
      "Pay online through CHIP (FPX online banking or card). No subscription. The Free package works for small get-togethers.",
    ],
    img: "/landing/guide-checkout.webp",
    alt: "Package page with Free, Premium and Exclusive",
    kind: "desk",
  },
  {
    title: "Make it yours",
    text: [
      "Add a cover photo. Tap a few ready-made snap missions (\"Selfie with the host\", \"Big group photo\") or write your own. Choose hashtags guests can tap.",
      "Decide how guests add photos: snap and upload, snap only (only new photos taken at the event), or closed.",
    ],
    img: "/landing/guide-missions.webp",
    alt: "Missions page with ideas to add",
    kind: "desk",
  },
  {
    title: "Share the QR code",
    text: [
      "Download the QR card as a PDF to print, or as an image to show on a screen or send in WhatsApp. It tells guests what to do in three short steps.",
      "Put it on tables, at the entrance, or on the slideshow screen. Until the event starts, guests who scan it see a countdown; at the start time the album opens.",
    ],
    img: "/landing/guide-qr.webp",
    alt: "QR card with the event name and three steps",
    kind: "desk",
  },
  {
    title: "During the event",
    text: [
      "Watch photos arrive on your dashboard. Open the live slideshow on a TV or projector: new photos and wishes appear by themselves.",
      "Every photo is checked automatically, and anything that looks like nudity is hidden until you look at it. Guests can report a photo too, and you can remove photos or block a guest any time.",
    ],
    img: "/landing/guide-host.webp",
    alt: "Host dashboard with photo, guest and storage counts",
    kind: "desk",
  },
  {
    title: "After the event",
    text: [
      "Download the whole album as one ZIP, sorted into a folder per guest, or tick just the photos you want. Guests get a recap of the day.",
      "Your event page shows the date photos will be deleted. We email you before that, and you can add more days if you need them.",
    ],
    img: "/landing/guide-photos.webp",
    alt: "Photos page with select and download",
    kind: "desk",
  },
];

const GUEST: Step[] = [
  {
    title: "Scan the QR code",
    text: ["Use the phone camera. The album opens in the browser — nothing to install, no account."],
    img: "/landing/guide-guest-open.webp",
    alt: "Guest page for a wedding on a phone",
    kind: "phone",
  },
  {
    title: "Add your name (and a selfie, if you like)",
    text: ["Your name goes on your photos so the hosts know who took them. The selfie is optional."],
    img: "/landing/guide-guest-join.webp",
    alt: "Join sheet with name and selfie",
    kind: "phone",
  },
  {
    title: "Snap or upload",
    text: [
      "Snap with the PixCamera: pick a film look, take the shot, add hashtags and a caption. Or upload photos you already took.",
      "You always see how many shots you have left.",
    ],
    img: "/landing/guide-guest-camera.webp",
    alt: "PixCamera with the Kodak Gold film look",
    kind: "phone",
  },
  {
    title: "Enjoy the album together",
    text: ["See everyone's photos as they arrive, by person, mission or hashtag. Heart your favourites, leave a wish for the hosts, and save any photo to your phone."],
    img: "/landing/guide-guest-highlights.webp",
    alt: "Highlights with best moments and people",
    kind: "phone",
  },
];

function Steps({ steps, start = 1 }: { steps: Step[]; start?: number }) {
  return (
    <ol className="grid gap-14 sm:gap-20">
      {steps.map((s, i) => (
        <li key={s.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
          <div className={i % 2 ? "md:order-2" : ""}>
            <span className="text-sm font-bold text-brand">Step {start + i}</span>
            <h3 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.title}</h3>
            {s.text.map((t) => (
              <p key={t} className="mt-3 text-muted-foreground">
                {t}
              </p>
            ))}
          </div>
          <div className={i % 2 ? "md:order-1" : ""}>
            {s.kind === "phone" ? <PhoneShot src={s.img} alt={s.alt} className="mx-auto w-full max-w-[17rem]" /> : <DeskShot src={s.img} alt={s.alt} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Guide() {
  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        <section className="container-page py-12 sm:py-16">
          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">How PixCherry works, step by step</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Setting up takes a few minutes. On the day, your guests do the rest. Screens below are from a real PixCherry album.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Guide sections">
            <a href="#hosts" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              For hosts
            </a>
            <a href="#guests" className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold hover:bg-muted">
              For guests
            </a>
          </nav>
        </section>

        <section id="hosts" className="scroll-mt-20 border-t border-border bg-white py-14 sm:py-20">
          <div className="container-page">
            <h2 className="mb-12 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">For hosts</h2>
            <Steps steps={HOST} />
          </div>
        </section>

        <section id="guests" className="scroll-mt-20 py-14 sm:py-20">
          <div className="container-page">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">For guests</h2>
            <p className="mb-12 max-w-xl text-muted-foreground">Send this part to anyone who asks &ldquo;how do I upload?&rdquo;</p>
            <Steps steps={GUEST} />
          </div>
        </section>

        <section className="container-page pb-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-ink p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Ready to set up your album?</h2>
              <p className="mt-1 text-white/75">
                Questions first? Read the <Link href="/#faq" className="font-semibold underline">FAQ</Link>.
              </p>
            </div>
            <LinkButton href="/dashboard/events/new" variant="brand" size="lg">
              Create your event <ArrowRight aria-hidden />
            </LinkButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
