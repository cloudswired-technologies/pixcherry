import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { ExplainerVideo } from "@/components/explainer-video";
import { PlanCard } from "@/components/plan-card";
import { DeskShot, PhoneShot } from "@/components/shot-frame";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listAddons, listPlans } from "@/lib/plans";
import chapters from "@/public/landing/chapters.json";

// Landing page. Every image is a screenshot of the real app (e2e/demo.spec.ts) and
// every number comes from the live packages, so the page can't promise what the
// product doesn't do.

export const dynamic = "force-dynamic";

const STEPS = [
  { img: "/landing/step-qr.webp", title: "Put the QR code out", text: "Print the QR card or show it on a screen. It tells guests what to do." },
  { img: "/landing/step-join.webp", title: "Guests scan and join", text: "The album opens in the phone's browser. They type a name — that's it." },
  { img: "/landing/step-snap.webp", title: "They snap and share", text: "With the built-in film camera, or photos already on their phone." },
  { img: "/landing/step-album.webp", title: "Everyone sees the album", text: "Photos land in one shared album in seconds, for you and every guest." },
];

const FAQ: [string, string][] = [
  ["Do guests need to download an app or make an account?", "No. They scan the QR code and the album opens in the phone's browser. They type their name (a selfie is optional) and start sharing."],
  ["Does it work on iPhone and Android?", "Yes, in the normal browser on both. iPhone photos (HEIC) are converted automatically."],
  ["What happens to photo quality?", "Photos are kept sharp: up to 3072 pixels on the long side, which is enough to print. They're shrunk a little on the phone first, so they upload quickly even on busy venue Wi-Fi."],
  ["How long are the photos kept?", "That depends on the package — your event page shows the exact deletion date. We email you before it happens, you can download everything at any time, and you can add more days if you need them."],
  ["Can I download all the photos?", "Yes. The whole album downloads as one ZIP with a folder for each guest, or you can tick just the photos you want. Every guest can save single photos to their phone."],
  ["What if someone uploads something inappropriate?", "Every photo is checked automatically, and anything that looks like nudity is hidden until you look at it. Guests can report a photo; after two reports it's hidden for you to check. You can delete any photo, block a guest, or approve every photo before it shows."],
  ["Who can see the album?", "Only people with the link or QR code. Albums aren't listed anywhere or shown in search engines."],
  ["Can I use it for a corporate event, a school event or a family day?", "Yes. Missions, hashtags and the slideshow work for any event — you choose your own wording."],
  ["Can guests still upload after the event?", "Yes, for a while: each package keeps uploads open for some hours after the event ends, so late photos still make it in."],
  ["How do I pay?", "Once per event, online through CHIP (FPX online banking or card). There's no subscription. The Free package costs nothing."],
  ["Can I change the event details or the link later?", "Yes. If you change the link, old QR codes keep working and take guests to the new one."],
];

function Feature({
  eyebrow,
  title,
  points,
  children,
  flip,
}: {
  eyebrow: string;
  title: string;
  points: string[];
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={flip ? "md:order-2" : ""}>
        <p className="text-sm font-bold text-brand">{eyebrow}</p>
        <h3 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h3>
        <ul className="mt-5 grid gap-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-muted-foreground">
              <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
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
        <section className="container-page grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">Every guest&apos;s photos. One album.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Put one QR code on the table. Guests scan it, snap with their phone and share — no app, no sign-up. You end up with every photo from the day, in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/dashboard/events/new" prefetch={false} variant="brand" size="lg" className="shadow-cherry">
                Create your event <ArrowRight aria-hidden />
              </LinkButton>
              <LinkButton href="/#video" variant="outline" size="lg">
                Watch a guest use it
              </LinkButton>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {free ? `Free for up to ${free.limits.max_guests} guests · ` : ""}
              {from !== null ? `paid packages from ${formatMoney(from)} per event · ` : ""}
              pay once, no subscription
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <img
              src="/landing/hero-tv.webp"
              alt="The live slideshow on a TV, showing a new photo and a wish"
              width={1600}
              height={900}
              className="w-full rounded-2xl shadow-lift"
              fetchPriority="high"
            />
            <PhoneShot src="/landing/hero-phone.webp" alt="The guest album on a phone" className="absolute -bottom-10 -left-4 w-[38%] sm:-left-10" priority />
            <p className="absolute -bottom-14 right-0 rotate-[-4deg] font-script text-2xl text-ink sm:text-3xl">on the TV, as they snap</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ how */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-20">
          <div className="container-page">
            <h2 className="max-w-xl text-4xl font-extrabold tracking-tight">Four steps, and you don&apos;t do the last three</h2>
            <ol className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  {i === 0 ? (
                    <div className="mx-auto grid aspect-[390/844] w-full max-w-[13rem] place-items-center rounded-[2.2rem] bg-canvas p-4">
                      <img src={s.img} alt="The printed QR card" width={640} height={905} loading="lazy" className="w-full rotate-[-3deg] rounded-xl shadow-lift" />
                    </div>
                  ) : (
                    <PhoneShot src={s.img} alt="" className="mx-auto w-full max-w-[13rem]" />
                  )}
                  <p className="mt-6 text-sm font-bold text-brand">{i + 1}</p>
                  <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-muted-foreground">
              Want the full walk-through?{" "}
              <Link href="/guide" className="font-semibold text-brand underline-offset-4 hover:underline">
                Read the step-by-step guide
              </Link>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ video */}
        <section id="video" className="scroll-mt-20 py-16 sm:py-20">
          <div className="container-page">
            <h2 className="text-4xl font-extrabold tracking-tight">A guest&apos;s first minute</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">A real recording of the guest side, from opening the album to leaving a wish. Tap a step to jump to it.</p>
            <div className="mt-10">
              <ExplainerVideo src={{ mp4: "/landing/guest.mp4", webm: "/landing/guest.webm" }} poster="/landing/video-poster.webp" chapters={chapters.chapters} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ features */}
        <section id="features" className="scroll-mt-20 border-t border-border bg-white py-16 sm:py-24">
          <div className="container-page grid gap-20 sm:gap-28">
            <div>
              <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight">More photos, because sharing is fun</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                A shared folder gets a handful of uploads. Give people a camera, a few challenges and a big screen, and they keep snapping.
              </p>
            </div>

            <Feature
              eyebrow="PixCamera"
              title="A film camera in every guest's phone"
              points={[
                "12 film looks, from Kodak Gold to Polaroid — guests see the look before they shoot.",
                "Zoom, focus, flash and a shots-left counter, like a disposable camera.",
                "Add hashtags and a caption, then share. The caption is printed under the photo when it's downloaded.",
              ]}
            >
              <div className="flex justify-center gap-4">
                <PhoneShot src="/landing/f-camera.webp" alt="PixCamera with the Kodak Gold look" className="w-[46%] max-w-[15rem]" />
                <PhoneShot src="/landing/f-camera-review.webp" alt="Reviewing a shot with a caption" className="mt-12 w-[46%] max-w-[15rem]" />
              </div>
            </Feature>

            <Feature
              flip
              eyebrow="Missions, hashtags, people"
              title="An album that sorts itself"
              points={[
                "Set snap missions like “Selfie with the host” or “Big group photo”. Guests tick them off.",
                "Hashtags (#ceremony, #dancefloor…) turn into their own little albums.",
                "Highlights shows the best moments, and every guest gets their own page of photos.",
              ]}
            >
              <div className="flex justify-center gap-4">
                <PhoneShot src="/landing/f-highlights.webp" alt="Highlights with best moments" className="w-[46%] max-w-[15rem]" />
                <PhoneShot src="/landing/f-missions.webp" alt="Snap missions" className="mt-12 w-[46%] max-w-[15rem]" />
              </div>
            </Feature>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="rounded-3xl bg-canvas p-6 sm:p-8">
                <h3 className="text-2xl font-extrabold tracking-tight">Hearts and top snappers</h3>
                <p className="mt-2 text-muted-foreground">Guests heart their favourites. The most loved photos rise to the top, and there&apos;s a leaderboard of who shared the most.</p>
                <PhoneShot src="/landing/f-viewer.webp" alt="A photo with hearts and a caption" className="mx-auto mt-8 w-full max-w-[14rem]" />
              </div>
              <div className="rounded-3xl bg-canvas p-6 sm:p-8">
                <h3 className="text-2xl font-extrabold tracking-tight">A wishes wall</h3>
                <p className="mt-2 text-muted-foreground">Guests leave a few words for the hosts. Wishes show in the album and scroll past on the slideshow.</p>
                <PhoneShot src="/landing/f-wishes.webp" alt="The wishes wall" className="mx-auto mt-8 w-full max-w-[14rem]" />
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-brand">Live slideshow</p>
              <h3 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight">Put the big screen to work</h3>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Open the slideshow on a TV or projector. New photos pop up as they&apos;re shared, with who snapped them, wishes scroll past, and a QR code in the corner lets more guests join.
              </p>
              <img src="/landing/f-slideshow.webp" alt="The live slideshow on a TV" width={1600} height={900} loading="lazy" className="mt-8 w-full rounded-2xl shadow-lift" />
            </div>

            <Feature
              eyebrow="For you, the host"
              title="Everything in one dashboard"
              points={[
                "See photos, guests and wishes as they come in, and how much storage is left.",
                "Every photo is checked automatically; anything that looks like nudity waits for you. Guests can report photos, and you can block a guest.",
                "Download the whole album as one ZIP, a folder per guest, or just the photos you tick.",
                "Photos are deleted automatically after your storage period. We remind you before, and you can add days.",
              ]}
            >
              <DeskShot src="/landing/f-host.webp" alt="The host dashboard for a wedding" />
            </Feature>

            <Feature
              flip
              eyebrow="After the party"
              title="A recap everyone can keep"
              points={[
                "When the event ends, guests get a recap: the most loved photos, top snappers and the wishes.",
                "Each guest can save a story card of their own photos for Instagram or WhatsApp.",
              ]}
            >
              <PhoneShot src="/landing/f-recap.webp" alt="The event recap" className="mx-auto w-full max-w-[16rem]" />
            </Feature>
          </div>
        </section>

        {/* ------------------------------------------------------------ events */}
        <section className="py-16 sm:py-20">
          <div className="container-page grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight">Not only weddings</h2>
              <p className="mt-3 text-muted-foreground">
                Birthdays, aqiqah, Raya open houses, company dinners, launches, conferences, sports days, graduations. Wherever people take photos, they can put them in one album.
              </p>
            </div>
            <div className="relative pb-10">
              <img src="/landing/f-corporate-tv.webp" alt="A conference album on the live slideshow" width={1600} height={900} loading="lazy" className="w-full rounded-2xl shadow-lift" />
              <PhoneShot src="/landing/f-corporate-phone.webp" alt="The same conference album on a guest's phone" className="absolute -bottom-2 right-4 w-[30%]" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-border bg-white py-16 sm:py-20">
          <div className="container-page">
            <h2 className="text-4xl font-extrabold tracking-tight">Pay once per event</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">No subscription. Pick the package that fits your guest list; you can upgrade or add more before or during the event.</p>
            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  action={
                    <LinkButton href={`/dashboard/events/new?plan=${p.code} prefetch={false}`} variant={p.is_featured ? "brand" : "primary"} size="lg" className="w-full">
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
        <section id="faq" className="scroll-mt-20 py-16 sm:py-20">
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
        <section className="pb-16">
          <div className="container-page">
            <div className="grid items-center gap-8 rounded-3xl bg-ink px-6 py-12 text-white sm:px-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight">Your guests are already taking the photos</h2>
                <p className="mt-3 max-w-lg text-white/75">Give them one place to put them. Set up your album now — it&apos;s ready the moment you pay.</p>
                <LinkButton href="/dashboard/events/new" prefetch={false} variant="brand" size="lg" className="mt-7">
                  Create your event <ArrowRight aria-hidden />
                </LinkButton>
              </div>
              <img src="/landing/qr-card.webp" alt="The QR card guests scan" loading="lazy" className="mx-auto w-full max-w-[16rem] rotate-2 rounded-2xl shadow-lift" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
