"use server";

import { revalidatePath } from "next/cache";
import { closeAccount } from "@/lib/account";
import { normaliseEmail, requireAdmin } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { audit } from "@/lib/settings";
import type { AdminState } from "../actions";

// Admin → Organisers. Every change is written to the audit log with the admin who made it.

type Target = { id: string; email: string; is_admin: boolean; suspended_at: Date | null };

async function target(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return one<Target>("select id, email, is_admin, suspended_at from users where id = $1", [id]);
}
const closed = (u: Target) => u.email.endsWith("@deleted.invalid");
const refresh = (id: string) => {
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
};

export async function saveUser(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const u = await target(id);
  if (!u) return { error: "Organiser not found." };
  if (closed(u)) return { error: "This account is closed." };
  const email = normaliseEmail(String(fd.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const name = String(fd.get("name") ?? "").trim().slice(0, 80) || null;
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 30) || null;
  if (phone && !/^[+\d][\d\s-]{5,}$/.test(phone)) return { error: "Phone: digits, spaces, dashes and an optional + only." };
  const note = String(fd.get("admin_note") ?? "").trim().slice(0, 2000) || null;
  try {
    await q("update users set email = $2, name = $3, phone = $4, admin_note = $5 where id = $1", [id, email, name, phone, note]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Another account already uses that email." };
    throw e;
  }
  await audit(admin.id, "user.update", id, { email_changed: email !== u.email }); // no addresses in the log (PDPA)
  refresh(id);
  return { ok: email === u.email ? "Saved." : `Saved. They now log in with ${email}.` };
}

export async function suspendUser(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const u = await target(id);
  if (!u) return { error: "Organiser not found." };
  if (u.id === admin.id) return { error: "You can't suspend your own account." };
  if (u.is_admin) return { error: "Remove their admin access first." };
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "Write a short reason (only admins see it)." };
  await q("update users set suspended_at = now(), suspended_reason = $2, session_version = session_version + 1 where id = $1", [id, reason]);
  await audit(admin.id, "user.suspend", id, { reason });
  refresh(id);
  return { ok: "Suspended and signed out. Their albums keep working for guests." };
}

export async function unsuspendUser(id: string) {
  const admin = await requireAdmin();
  const u = await target(id);
  if (!u?.suspended_at) return;
  await q("update users set suspended_at = null, suspended_reason = null where id = $1", [id]);
  await audit(admin.id, "user.unsuspend", id);
  refresh(id);
}

export async function signOutUser(id: string) {
  const admin = await requireAdmin();
  if (!(await target(id))) return;
  await q("update users set session_version = session_version + 1 where id = $1", [id]);
  await audit(admin.id, "user.signout", id);
  refresh(id);
}

export async function setAdmin(id: string, on: boolean) {
  const admin = await requireAdmin();
  const u = await target(id);
  if (!u || closed(u) || u.suspended_at) return;
  if (!on) {
    if (u.id === admin.id) return; // never lock yourself out
    const others = await one<{ n: number }>("select count(*)::int n from users where is_admin and id <> $1", [id]);
    if (!others?.n) return;
  }
  await q("update users set is_admin = $2 where id = $1", [id, on]);
  await audit(admin.id, on ? "user.admin_on" : "user.admin_off", id);
  refresh(id);
}

export async function closeUser(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const u = await target(id);
  if (!u) return { error: "Organiser not found." };
  if (closed(u)) return { error: "This account is already closed." };
  if (u.id === admin.id) return { error: "Close your own account from Account instead." };
  if (u.is_admin) return { error: "Remove their admin access first." };
  if (String(fd.get("confirm_email") ?? "").trim().toLowerCase() !== u.email) return { error: "Type their email exactly to confirm." };
  await closeAccount(id);
  await audit(admin.id, "user.close", id); // no email in the log: closing anonymises the account
  refresh(id);
  return { ok: "Account closed. Their photos are deleted; payments and receipts are kept." };
}
