import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { one, q } from "@/lib/db";
import { hmac, safeEqual, sign, unsign } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { codeEmail } from "@/lib/email-templates";

// Organiser login: 6-digit code by email, then a signed session cookie.
// Bumping users.session_version signs the user out everywhere.

const COOKIE = "pc_session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type User = { id: string; email: string; name: string | null; phone: string | null; is_admin: boolean };

type Session = { uid: string; v: number; exp: number };

export const currentUser = cache(async (): Promise<User | null> => {
  const s = unsign<Session>((await cookies()).get(COOKIE)?.value);
  if (!s || s.exp < Date.now()) return null;
  return one<User>(
    "select id, email, name, phone, is_admin from users where id = $1 and session_version = $2",
    [s.uid, s.v],
  );
});

export async function requireUser(next = "/dashboard") {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdmin() {
  const u = await requireUser("/admin");
  if (!u.is_admin) redirect("/dashboard");
  return u;
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(/[,\s]+/).filter(Boolean);
}

const codeHash = (email: string, code: string) => hmac(`login:${email}:${code}`);

export function normaliseEmail(raw: string) {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200 ? e : null;
}

/** Sends a login code. Always "succeeds" from the caller's view (no account probing). */
export async function sendLoginCode(email: string) {
  const recent = await one<{ n: number }>(
    "select count(*)::int as n from login_codes where email = $1 and created_at > now() - interval '15 minutes'",
    [email],
  );
  if ((recent?.n ?? 0) >= 5) return;
  // Tests use a fixed code; never honoured in production builds.
  const fixed = process.env.NODE_ENV !== "production" ? process.env.DEV_FIXED_LOGIN_CODE : undefined;
  const code = fixed && /^\d{6}$/.test(fixed) ? fixed : String(randomInt(0, 1_000_000)).padStart(6, "0");
  await q("insert into login_codes (email, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))", [
    email,
    codeHash(email, code),
    CODE_MINUTES,
  ]);
  if (process.env.NODE_ENV !== "production" && !process.env.ZEPTOMAIL_TOKEN) console.log(`[dev] login code for ${email}: ${code}`);
  await sendEmail({ to: email, template: "login_code", ...codeEmail(code, CODE_MINUTES) });
}

/** Checks the code; on success creates the user if needed and sets the session cookie. */
export async function verifyLoginCode(email: string, code: string): Promise<"ok" | "invalid" | "expired"> {
  const row = await one<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
    `select id, code_hash, attempts, expires_at < now() as expired from login_codes
     where email = $1 and used_at is null order by created_at desc limit 1`,
    [email],
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) return "expired";
  if (row.expired) return "expired";
  if (!/^\d{6}$/.test(code) || !safeEqual(row.code_hash, codeHash(email, code))) {
    await q("update login_codes set attempts = attempts + 1 where id = $1", [row.id]);
    return "invalid";
  }
  await q("update login_codes set used_at = now() where id = $1", [row.id]);
  const user = await one<{ id: string; session_version: number }>(
    `insert into users (email, is_admin, last_login_at) values ($1, $2, now())
     on conflict (email) do update set last_login_at = now(), is_admin = users.is_admin or excluded.is_admin
     returning id, session_version`,
    [email, adminEmails().includes(email)],
  );
  const session: Session = { uid: user!.id, v: user!.session_version, exp: Date.now() + SESSION_DAYS * 86400_000 };
  (await cookies()).set(COOKIE, sign(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return "ok";
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
