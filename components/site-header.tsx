import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { LinkButton, Logo } from "@/components/ui";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" aria-label="PixCherry home">
          <Logo className="text-lg" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/#pricing" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-muted sm:inline-flex">
            Pricing
          </Link>
          <Link href="/#how" className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-muted sm:inline-flex">
            How it works
          </Link>
          {user ? (
            <LinkButton href="/dashboard" size="sm">
              My events
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium hover:bg-muted">
                Log in
              </Link>
              <LinkButton href="/dashboard/events/new" size="sm" variant="brand">
                Create event
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 text-sm text-muted-foreground">
      <div className="container-page flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <span>© {new Date().getFullYear()} Cloudswired Technologies</span>
        </div>
      </div>
    </footer>
  );
}
