import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(site)/login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="My events">
            <Logo />
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            {user.is_admin ? (
              <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-muted">
                <Shield className="size-4" aria-hidden /> Admin
              </Link>
            ) : null}
            <span className="hidden truncate px-2 text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={logout}>
              <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-muted" aria-label="Log out">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="container-page py-6 sm:py-8">{children}</main>
    </div>
  );
}
