import Link from "next/link";
import { Logo } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export const metadata = { title: { default: "Admin", template: "%s · Admin · PixCherry" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-ink text-white">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo light />
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Admin</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-white/80 hover:text-white">
            My events
          </Link>
        </div>
      </header>
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <AdminNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
