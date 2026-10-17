"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgePercent,
  CalendarHeart,
  ChevronDown,
  ExternalLink,
  Gauge,
  Gem,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleHeart,
  Package,
  Plus,
  QrCode,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(site)/login/actions";
import { Logo } from "@/components/brand";
import { cn } from "@/components/ui";

// PixCherry dashboard frame (organisers and admin), light and warm like the
// guest app: white sidebar, cream canvas, cherry for "you are here".
//  * Desktop: sidebar with groups. Inside an event it shows that event (cover,
//    status, switcher) and the event's own menu.
//  * Phones: a top bar with the menu as a slide-in drawer, plus a bottom bar
//    with the most-used pages.

const ICONS = {
  overview: LayoutDashboard,
  photos: Images,
  guests: Users,
  missions: Target,
  wishes: MessageCircleHeart,
  qr: QrCode,
  settings: Settings,
  package: Package,
  events: CalendarHeart,
  plans: Gem,
  promos: BadgePercent,
  logs: ScrollText,
  gauge: Gauge,
  demo: Sparkles,
  admin: Shield,
  account: UserRound,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: number; bottom?: boolean; group?: string };
export type ShellEvent = { id: string; name: string; phase: string; phaseTone: "ok" | "brand" | "warn" | "neutral" | "danger"; cover: string | null; review: number; guestUrl: string | null };

const TONE = { ok: "bg-ok", brand: "bg-brand", warn: "bg-[#f59e0b]", neutral: "bg-muted-foreground/50", danger: "bg-danger" } as const;

function eventNav(e: { id: string; review: number }, features: { missions: boolean; wishes: boolean }): NavItem[] {
  const b = `/dashboard/events/${e.id}`;
  return [
    { href: b, label: "Overview", icon: "overview", exact: true, bottom: true, group: "Event" },
    { href: `${b}/photos`, label: "Photos", icon: "photos", badge: e.review, bottom: true, group: "Event" },
    { href: `${b}/guests`, label: "Guests", icon: "guests", bottom: true, group: "Event" },
    ...(features.missions ? [{ href: `${b}/missions`, label: "Missions", icon: "missions" as const, group: "Fun" }] : []),
    ...(features.wishes ? [{ href: `${b}/wishes`, label: "Wishes", icon: "wishes" as const, group: "Fun" }] : []),
    { href: `${b}/qr`, label: "QR & sharing", icon: "qr", group: "Setup" },
    { href: `${b}/settings`, label: "Settings", icon: "settings", group: "Setup" },
    { href: `${b}/checkout`, label: "Package", icon: "package", group: "Setup" },
  ];
}

const isOn = (path: string, i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));

export function DashShell({
  user,
  events,
  admin,
  children,
}: {
  user: { email: string; name: string | null; isAdmin: boolean };
  /** The organiser's events (for the event menu and switcher). */
  events?: (ShellEvent & { features: { missions: boolean; wishes: boolean } })[];
  /** Admin area: its own menu instead of events. */
  admin?: NavItem[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const eventId = path.match(/^\/dashboard\/events\/([0-9a-f-]{36})/)?.[1] ?? null;
  const current = eventId ? (events?.find((e) => e.id === eventId) ?? null) : null;
  const nav: NavItem[] = admin ?? (eventId ? eventNav(current ?? { id: eventId, review: 0 }, current?.features ?? { missions: true, wishes: true }) : []);
  const bottom = nav.filter((i) => i.bottom);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const side = <SideContent user={user} events={events ?? []} current={current} nav={nav} admin={!!admin} path={path} onNavigate={() => setDrawer(false)} />;
  const title = admin ? "Admin" : (current?.name ?? (path.startsWith("/dashboard/events/new") ? "New event" : path.startsWith("/dashboard/account") ? "Account" : "My events"));

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-border bg-card lg:flex">{side}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-xl hover:bg-muted" aria-label="Open menu" aria-expanded={drawer}>
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{title}</span>
        {current?.guestUrl ? (
          <a href={current.guestUrl} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Open the guest page">
            <ExternalLink className="size-[18px]" aria-hidden />
          </a>
        ) : null}
      </header>

      <div className={cn("fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm transition-opacity lg:hidden", drawer ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setDrawer(false)} aria-hidden />
      <aside
        className={cn("fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-xs flex-col bg-card shadow-lift transition-transform duration-300 ease-out lg:hidden", drawer ? "translate-x-0" : "-translate-x-full")}
        aria-label="Menu"
        aria-hidden={!drawer}
        inert={!drawer}
      >
        <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.9rem)] z-10 grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Close menu">
          <X className="size-5" aria-hidden />
        </button>
        {side}
      </aside>

      <div className="lg:pl-[264px]">
        <main className={cn("mx-auto w-full max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8", bottom.length ? "pb-28 lg:pb-12" : "pb-12")}>{children}</main>
      </div>

      {bottom.length ? (
        <nav aria-label="Quick menu" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {bottom.map((i) => {
              const Icon = ICONS[i.icon];
              const on = isOn(path, i);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={on ? "page" : undefined} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", on ? "text-brand" : "text-muted-foreground")}>
                    <span className={cn("grid h-7 w-12 place-items-center rounded-full", on && "bg-brand-soft")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {i.label}
                    {i.badge ? <span className="absolute right-[calc(50%-1.6rem)] top-2 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{i.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <span className="grid h-7 w-12 place-items-center">
                  <Menu className="size-5" aria-hidden />
                </span>
                More
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

function SideContent({
  user,
  events,
  current,
  nav,
  admin,
  path,
  onNavigate,
}: {
  user: { email: string; name: string | null; isAdmin: boolean };
  events: ShellEvent[];
  current: ShellEvent | null;
  nav: NavItem[];
  admin: boolean;
  path: string;
  onNavigate: () => void;
}) {
  const [switching, setSwitching] = useState(false);
  const others = events.filter((e) => e.id !== current?.id && e.phase !== "Photos deleted").slice(0, 8);
  const groups = [...new Set(nav.map((i) => i.group ?? ""))];
  const display = user.name || user.email.split("@")[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <Link href={admin ? "/admin" : "/dashboard"} onClick={onNavigate} aria-label="Home">
          <Logo className="text-xl" />
        </Link>
        {admin ? <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Admin</span> : null}
      </div>

      {admin ? null : (
        <div className="grid gap-1 px-3">
          <SideLink href="/dashboard" label="My events" icon="events" on={path === "/dashboard"} onNavigate={onNavigate} />
          <Link href="/dashboard/events/new" onClick={onNavigate} className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-cherry hover:bg-brand-strong">
            <Plus className="size-4" aria-hidden /> New event
          </Link>
        </div>
      )}

      {current ? (
        <div className="mx-3 mt-4 overflow-hidden rounded-2xl border border-border bg-canvas/60">
          <button type="button" onClick={() => setSwitching((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={switching} aria-label="Switch event">
            {current.cover ? (
              <img src={current.cover} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#ff8a5c] text-lg">📸</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{current.name}</span>
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", TONE[current.phaseTone])} />
                {current.phase}
              </span>
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", switching && "rotate-180")} aria-hidden />
          </button>
          {switching ? (
            <div className="grid gap-0.5 border-t border-border bg-card p-1.5">
              {others.length ? (
                others.map((e) => (
                  <Link key={e.id} href={`/dashboard/events/${e.id}`} onClick={() => (setSwitching(false), onNavigate())} className="truncate rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                    {e.name}
                  </Link>
                ))
              ) : (
                <span className="px-2.5 py-2 text-xs text-muted-foreground">No other events.</span>
              )}
            </div>
          ) : null}
          {current.guestUrl ? (
            <a href={current.guestUrl} target="_blank" rel="noreferrer" className="m-2 mt-0 flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-xs font-bold text-white shadow-cherry hover:bg-brand-strong">
              📸 Open guest app <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-4" aria-label={admin ? "Admin" : "Event"}>
        {groups.map((g) => (
          <div key={g} className="mt-2">
            {g ? <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{g}</p> : null}
            <ul className="grid gap-0.5">
              {nav
                .filter((i) => (i.group ?? "") === g)
                .map((i) => (
                  <li key={i.href}>
                    <SideLink href={i.href} label={i.label} icon={i.icon} badge={i.badge} on={isOn(path, i)} onNavigate={onNavigate} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="grid gap-0.5 border-t border-border px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {user.isAdmin ? (
          admin ? (
            <SideLink href="/dashboard" label="My events" icon="events" on={false} onNavigate={onNavigate} />
          ) : (
            <SideLink href="/admin" label="Admin" icon="admin" on={false} onNavigate={onNavigate} />
          )
        ) : null}
        <SideLink href="/dashboard/account" label="Account" icon="account" on={path.startsWith("/dashboard/account")} onNavigate={onNavigate} />
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-canvas px-2.5 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold uppercase text-white">{display.charAt(0)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{display}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
          </span>
          <form action={logout}>
            <button className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Log out">
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SideLink({ href, label, icon, badge, on, onNavigate }: { href: string; label: string; icon: NavIcon; badge?: number; on: boolean; onNavigate: () => void }) {
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        on ? "bg-brand-soft font-semibold text-brand-strong" : "text-foreground/75 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}
