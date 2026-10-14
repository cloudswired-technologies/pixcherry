import "server-only";
import { q } from "@/lib/db";

// Transactional email through ZeptoMail's HTTP API. Without ZEPTOMAIL_TOKEN
// (local development) messages are only logged.

export type Email = { to: string; subject: string; html: string; text: string; template: string };

export async function sendEmail(email: Email): Promise<boolean> {
  const token = process.env.ZEPTOMAIL_TOKEN;
  const from = process.env.EMAIL_FROM ?? "no-reply@pixcherry.com";
  let ok = false;
  let error: string | null = null;
  if (!token) {
    error = "not_configured";
    if (process.env.NODE_ENV !== "production") console.log(`[dev email] to=${email.to} subject=${email.subject}`);
  } else {
    try {
      const api = (process.env.ZEPTOMAIL_API_URL ?? "https://api.zeptomail.com").replace(/\/$/, "");
      const res = await fetch(`${api}/v1.1/email`, {
        method: "POST",
        headers: {
          Authorization: token.startsWith("Zoho-enczapikey") ? token : `Zoho-enczapikey ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: { address: from, name: "PixCherry" },
          to: [{ email_address: { address: email.to } }],
          subject: email.subject,
          htmlbody: email.html,
          textbody: email.text,
          track_opens: false,
          track_clicks: false,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      ok = res.ok;
      if (!ok) error = `${res.status} ${(await res.text()).slice(0, 300)}`;
    } catch (e) {
      error = e instanceof Error ? e.message : "request_failed";
    }
  }
  if (error && error !== "not_configured") console.error(`email ${email.template} failed: ${error}`);
  await q("insert into email_log (to_email, template, ok, error) values ($1, $2, $3, $4)", [
    email.to.slice(0, 200),
    email.template,
    ok,
    error?.slice(0, 500) ?? null,
  ]).catch(() => {});
  return ok;
}
