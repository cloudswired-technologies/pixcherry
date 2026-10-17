import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui";
import { currentUser } from "@/lib/auth";

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
