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
  ImageIcon,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageCircleHeart,
  Package,
  Plus,
  QrCode,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(site)/login/actions";
import { Logo } from "@/components/brand";
import { cn } from "@/components/ui";

// PixCherry dashboard frame (organisers and admin).
//  * Desktop: a charcoal sidebar. Inside an event it shows that event (cover,
//    status, switcher) and the event's own menu.
//  * Phones: a top bar with the menu as a slide-in drawer, plus a bottom bar
//    with the most-used event pages.

const ICONS = {
  overview: LayoutDashboard,
  photos: Images,
  guests: Users,
  missions: Target,
  wishes: MessageCircleHeart,
  comments: MessageCircle,
  qr: QrCode,
  settings: Settings,
  package: Package,
  events: CalendarHeart,
  plans: Gem,
  quality: ImageIcon,
  addons: Sparkles,
  promos: BadgePercent,
  logs: ScrollText,
  gauge: Gauge,
  admin: Shield,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: number; bottom?: boolean };
export type ShellEvent = { id: string; name: string; phase: string; phaseTone: "ok" | "brand" | "warn" | "neutral" | "danger"; cover: string | null; review: number; guestUrl: string | null };

const TONE = { ok: "bg-[#16a34a]", brand: "bg-brand", warn: "bg-[#f59e0b]", neutral: "bg-white/40", danger: "bg-[#ef4444]" } as const;

function eventNav(e: { id: string; review: number }, features: { missions: boolean; wishes: boolean; comments: boolean }): NavItem[] {
  const b = `/dashboard/events/${e.id}`;
  return [
    { href: b, label: "Overview", icon: "overview", exact: true, bottom: true },
    { href: `${b}/photos`, label: "Photos", icon: "photos", badge: e.review, bottom: true },
    { href: `${b}/guests`, label: "Guests", icon: "guests", bottom: true },
    ...(features.missions ? [{ href: `${b}/missions`, label: "Missions", icon: "missions" as const }] : []),
    ...(features.wishes ? [{ href: `${b}/wishes`, label: "Wishes", icon: "wishes" as const }] : []),
    ...(features.comments ? [{ href: `${b}/comments`, label: "Comments", icon: "comments" as const }] : []),
    { href: `${b}/qr`, label: "QR & sharing", icon: "qr" },
    { href: `${b}/settings`, label: "Settings", icon: "settings" },
    { href: `${b}/checkout`, label: "Package", icon: "package" },
  ];
}

const isOn = (path: string, i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));

export function DashShell({
  user,
  events,
  admin,
  children,
}: {
  user: { email: string; isAdmin: boolean };
  /** The organiser's events (for the event menu and switcher). */
  events?: (ShellEvent & { features: { missions: boolean; wishes: boolean; comments: boolean } })[];
  /** Admin area: its own menu instead of events. */
  admin?: NavItem[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const eventId = path.match(/^\/dashboard\/events\/([0-9a-f-]{36})/)?.[1] ?? null;
  const current = eventId ? (events?.find((e) => e.id === eventId) ?? null) : null;
  const nav: NavItem[] = admin ?? (eventId ? eventNav(current ?? { id: eventId, review: 0 }, current?.features ?? { missions: true, wishes: true, comments: true }) : []);
  const bottom = nav.filter((i) => i.bottom);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const side = <SideContent user={user} events={events ?? []} current={current} nav={nav} admin={!!admin} path={path} onNavigate={() => setDrawer(false)} />;
  const title = admin ? "Admin" : (current?.name ?? (path.startsWith("/dashboard/events/new") ? "New event" : "My events"));

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col overflow-hidden bg-ink text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        {side}
      </aside>

      {/* Phone top bar */}
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

      {/* Phone drawer */}
      <div className={cn("fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm transition-opacity lg:hidden", drawer ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setDrawer(false)} aria-hidden />
      <aside
        className={cn("fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-xs flex-col overflow-hidden bg-ink text-white shadow-lift transition-transform duration-300 ease-out lg:hidden", drawer ? "translate-x-0" : "-translate-x-full")}
        aria-label="Menu"
        aria-hidden={!drawer}
        inert={!drawer}
      >
        <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 grid size-9 place-items-center rounded-xl text-white/70 hover:bg-white/10" aria-label="Close menu">
          <X className="size-5" aria-hidden />
        </button>
        {side}
      </aside>

      <div className="lg:pl-[272px]">
        <main className={cn("mx-auto w-full max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8", bottom.length ? "pb-28 lg:pb-12" : "pb-12")}>{children}</main>
      </div>

      {/* Phone bottom bar (event pages) */}
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
  user: { email: string; isAdmin: boolean };
  events: ShellEvent[];
  current: ShellEvent | null;
  nav: NavItem[];
  admin: boolean;
  path: string;
  onNavigate: () => void;
}) {
  const [switching, setSwitching] = useState(false);
  const others = events.filter((e) => e.id !== current?.id && e.phase !== "Photos deleted").slice(0, 8);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-5 pb-4 pt-5">
        <Link href={admin ? "/admin" : "/dashboard"} onClick={onNavigate} aria-label="Home">
          <Logo className="text-xl" light />
        </Link>
        {admin ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">Admin</span> : null}
      </div>

      <div className="px-3">
        {admin ? null : (
          <div className="grid gap-1">
            <SideLink href="/dashboard" label="My events" icon="events" on={path === "/dashboard"} onNavigate={onNavigate} />
            <Link href="/dashboard/events/new" onClick={onNavigate} className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-cherry hover:bg-brand-strong">
              <Plus className="size-4" aria-hidden /> New event
            </Link>
          </div>
        )}
      </div>

      {current ? (
        <div className="mx-3 mt-5 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
          <button type="button" onClick={() => setSwitching((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={switching} aria-label="Switch event">
            {current.cover ? (
              <img src={current.cover} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#ff7a93] text-lg">📸</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{current.name}</span>
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-white/70">
                <span className={cn("size-2 rounded-full", TONE[current.phaseTone])} />
                {current.phase}
              </span>
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-white/60 transition-transform", switching && "rotate-180")} aria-hidden />
          </button>
          {switching ? (
            <div className="grid gap-0.5 border-t border-white/10 p-1.5">
              {others.length ? (
                others.map((e) => (
                  <Link key={e.id} href={`/dashboard/events/${e.id}`} onClick={() => (setSwitching(false), onNavigate())} className="truncate rounded-lg px-2.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                    {e.name}
                  </Link>
                ))
              ) : (
                <span className="px-2.5 py-2 text-xs text-white/50">No other events.</span>
              )}
            </div>
          ) : null}
          {current.guestUrl ? (
            <a href={current.guestUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 border-t border-white/10 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Open guest page <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}

      {nav.length ? (
        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label={admin ? "Admin" : "Event"}>
          <ul className="grid gap-0.5">
            {nav.map((i) => (
              <li key={i.href}>
                <SideLink href={i.href} label={i.label} icon={i.icon} badge={i.badge} on={isOn(path, i)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      <div className="grid gap-1 border-t border-white/10 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        {user.isAdmin ? (
          admin ? (
            <SideLink href="/dashboard" label="My events" icon="events" on={false} onNavigate={onNavigate} />
          ) : (
            <SideLink href="/admin" label="Admin" icon="admin" on={false} onNavigate={onNavigate} />
          )
        ) : null}
        <div className="flex items-center gap-2 px-3 pt-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold uppercase">{user.email.charAt(0)}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-white/70">{user.email}</span>
          <form action={logout}>
            <button className="grid size-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Log out">
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
        on ? "bg-white/[0.12] font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {on ? <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" aria-hidden /> : null}
      <Icon className={cn("size-5 shrink-0", on ? "text-brand" : "")} aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}
