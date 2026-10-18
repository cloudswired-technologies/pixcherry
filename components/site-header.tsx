import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { SOCIAL } from "@/lib/seo";

// Brand glyphs as 24px stroke icons, in the same style as the rest of the site's icons.
const SOCIAL_ICON: Record<(typeof SOCIAL)[number]["name"], React.ReactNode> = {
  Facebook: <path d="M7 10v4h3v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1h3V3h-3a5 5 0 0 0-5 5v2H7" />,
  Instagram: (
    <>
      <path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />
      <path d="M16.5 7.5v.01" />
    </>
  ),
  Threads: <path d="M19 7.5C17.667 4.5 15.333 3 12 3c-5 0-8 2.5-8 9s3.5 9 8 9 7-3 7-5-1-5-7-5c-2.5 0-3 1.25-3 2.5 0 1.5 1 2.5 2.5 2.5 2.5 0 3.5-1.5 3.5-5s-2-4-3-4-1.833.333-2.5 1" />,
  TikTok: <path d="M21 7.917v4.034A9.948 9.948 0 0 1 16 10v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2V3h4.083A6.005 6.005 0 0 0 21 7.917z" />,
};

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/guide", label: "Guide" },
  { href: "/demo", label: "Live demo" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" aria-label="PixCherry home">
          <Logo className="text-xl" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-sm font-medium text-ink/80 hover:bg-muted hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <LinkButton href="/dashboard" size="sm" variant="brand">
              My events
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-muted sm:inline-flex">
                Log in
              </Link>
              <LinkButton href="/dashboard/events/new" size="sm" variant="brand" className="hidden sm:inline-flex">
                Create event
              </LinkButton>
            </>
          )}
          <details className="group relative md:hidden">
            <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full hover:bg-muted" aria-label="Menu">
              <Menu className="size-6" aria-hidden />
            </summary>
            <div className="absolute right-0 top-12 grid w-56 gap-1 rounded-2xl border border-border bg-white p-2 shadow-lift">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  {n.label}
                </Link>
              ))}
              {!user ? (
                <>
                  <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted">
                    Log in
                  </Link>
                  <LinkButton href="/dashboard/events/new" variant="brand" className="mt-1">
                    Create your event
                  </LinkButton>
                </>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink py-14 text-white">
      <div className="container-page grid justify-items-center gap-6 text-center">
        <Logo className="text-2xl" light tagline />
        <ul className="flex gap-2" aria-label="PixCherry on social media">
          {SOCIAL.map((s) => (
            <li key={s.name}>
              <a
                href={s.url}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={`PixCherry on ${s.name}`}
                className="grid size-10 place-items-center rounded-full text-white/80 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {SOCIAL_ICON[s.name]}
                </svg>
              </a>
            </li>
          ))}
        </ul>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/#features" className="hover:text-white">
            Features
          </Link>
          <Link href="/guide" className="hover:text-white">
            Guide
          </Link>
          <Link href="/#pricing" className="hover:text-white">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-white">
            FAQ
          </Link>
          <a href="mailto:support@pixcherry.com" className="hover:text-white">
            Contact
          </a>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
        </nav>
        <div className="w-full max-w-md border-t border-white/10 pt-6 text-xs text-white/50">© {new Date().getFullYear()} PixCherry by Cloudswired Technologies. All rights reserved.</div>
      </div>
    </footer>
  );
}
