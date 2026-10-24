import { DashShell, type NavItem } from "@/components/dash-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "Admin", template: "%s · Admin · PixCherry" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "gauge", exact: true, bottom: true, group: "Insights" },
  { href: "/admin/events", label: "Events", icon: "events", bottom: true, group: "Business" },
  { href: "/admin/users", label: "Organisers", icon: "organisers", bottom: true, group: "Business" },
  { href: "/admin/payments", label: "Payments", icon: "payments", bottom: true, group: "Business" },
  { href: "/admin/plans", label: "Packages & add-ons", icon: "plans", group: "Business" },
  { href: "/admin/promos", label: "Promo codes", icon: "promos", group: "Business" },
  { href: "/admin/demos", label: "Demo albums", icon: "demo", group: "Business" },
  { href: "/admin/settings", label: "Settings", icon: "settings", group: "System" },
  { href: "/admin/logs", label: "Logs", icon: "logs", group: "System" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <DashShell user={{ email: user.email, name: user.name, isAdmin: true }} admin={NAV}>
      {children}
    </DashShell>
  );
}
