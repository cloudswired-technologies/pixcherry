"use server";

import { redirect } from "next/navigation";
import { closeAccount } from "@/lib/account";
import { requireUser, signOut } from "@/lib/auth";
import { q } from "@/lib/db";

export type AccountState = { error?: string; ok?: string };

export async function saveProfile(_: AccountState, fd: FormData): Promise<AccountState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").replace(/[<>]/g, "").trim().slice(0, 80) || null;
  const phone = String(fd.get("phone") ?? "").replace(/[^\d+ -]/g, "").trim().slice(0, 20) || null;
  await q("update users set name = $2, phone = $3 where id = $1", [user.id, name, phone]);
  return { ok: "Saved." };
}

export async function deleteAccount(_: AccountState, fd: FormData): Promise<AccountState> {
  const user = await requireUser();
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== user.email) return { error: "Type your email address exactly to confirm." };
  await closeAccount(user.id);
  await signOut();
  redirect("/?account=closed");
}
