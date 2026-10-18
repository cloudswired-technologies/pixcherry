import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Small set of shared UI pieces. Plain Tailwind, no component library.

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const BTN = {
  primary: "bg-ink text-white hover:bg-ink/85",
  brand: "bg-brand text-white hover:bg-brand-strong",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-danger-soft text-danger hover:bg-danger/15",
} as const;
const SIZE = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" } as const;

export type BtnVariant = keyof typeof BTN;

export function btn(variant: BtnVariant = "primary", size: keyof typeof SIZE = "md", extra?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
    BTN[variant],
    SIZE[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant; size?: keyof typeof SIZE }) {
  return <button {...p} className={btn(variant, size, className)} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof SIZE }) {
  return <Link {...p} className={btn(variant, size, className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cn("rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6", className)} />;
}

export function Input({ className, ...p }: ComponentProps<"input">) {
  return (
    <input
      {...p}
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-base outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ink disabled:opacity-60",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cn("min-h-24 w-full rounded-xl border border-input bg-card px-3 py-2 text-base outline-none focus:border-ink", className)} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cn("h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-ink", className)} />;
}

export function Field({ label, help, children, htmlFor }: { label: string; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function Toggle({ name, label, help, defaultChecked, disabled }: { name: string; label: string; help?: ReactNode; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-3 rounded-xl border border-border bg-card p-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 size-5 shrink-0 accent-brand" />
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        {help ? <span className="text-xs text-muted-foreground">{help}</span> : null}
      </span>
    </label>
  );
}

const BADGE = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand-strong",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE[tone])}>{children}</span>;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger"; children: ReactNode }) {
  const t = { neutral: "bg-muted text-foreground", ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", danger: "bg-danger-soft text-danger" }[tone];
  return <div className={cn("rounded-xl px-4 py-3 text-sm", t)}>{children}</div>;
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export { Logo } from "@/components/brand";
