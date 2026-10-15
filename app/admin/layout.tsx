import { DashShell, type NavItem } from "@/components/dash-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "Admin", template: "%s · Admin · PixCherry" } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "gauge", exact: true },
  { href: "/admin/events", label: "Events", icon: "events" },
  { href: "/admin/plans", label: "Packages", icon: "plans" },
  { href: "/admin/quality", label: "Photo quality", icon: "quality" },
  { href: "/admin/addons", label: "Add-ons", icon: "addons" },
  { href: "/admin/promos", label: "Promo codes", icon: "promos" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/admin/logs", label: "Logs", icon: "logs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <DashShell user={{ email: user.email, isAdmin: true }} admin={NAV}>
      {children}
    </DashShell>
  );
}
