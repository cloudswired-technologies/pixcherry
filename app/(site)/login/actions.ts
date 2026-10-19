"use server";

import { redirect } from "next/navigation";
import { normaliseEmail, sendLoginCode, signOut, verifyLoginCode } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; next?: string };

function safeNext(raw: FormDataEntryValue | null) {
  const s = String(raw ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function requestCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const next = safeNext(fd.get("next"));
  const email = normaliseEmail(String(fd.get("email") ?? ""));
  if (!email) return { step: "email", error: "Enter a valid email address.", next };
  if (!(await rateLimit("login-send", 10, 15 * 60_000))) return { step: "email", error: "Too many attempts. Please wait a few minutes.", next };
  if (!(await verifyTurnstile(String(fd.get("cf-turnstile-response") ?? "")))) return { step: "email", error: "Please complete the check and try again.", next };
  await sendLoginCode(email);
  return { step: "code", email, next };
}

export async function checkCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const next = safeNext(fd.get("next"));
  const email = normaliseEmail(String(fd.get("email") ?? ""));
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { step: "email", error: "Start again with your email.", next };
  if (!(await rateLimit("login-check", 20, 15 * 60_000))) return { step: "code", email, error: "Too many attempts. Please wait a few minutes.", next };
  const r = await verifyLoginCode(email, code);
  if (r === "invalid") return { step: "code", email, error: "That code isn't right. Check the latest email.", next };
  if (r === "expired") return { step: "email", email, error: "That code has expired. We'll send a new one.", next };
  if (r === "suspended") return { step: "email", email, error: "This account is suspended. Email support@pixcherry.com if you think this is a mistake.", next };
  redirect(next);
}

export async function logout() {
  await signOut();
  redirect("/");
}
