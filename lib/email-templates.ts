import { APP_URL } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/format";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }, subject = heading) {
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ef;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1c1917;color:#ffffff;padding:18px 24px;font-size:16px;font-weight:bold">PixCherry</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(p)}</p>`).join("")}
${button ? `<p style="margin:20px 0"><a href="${esc(button.url)}" style="background:#e8553d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;display:inline-block">${esc(button.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : [])].join("\n");
  return { subject, html, text };
}

export function codeEmail(code: string, minutes: number) {
  return layout(
    `Your login code: ${code}`,
    [`Enter this code to sign in to PixCherry. It expires in ${minutes} minutes.`, "If you didn't ask for it, you can ignore this email."],
    undefined,
    `${code} is your PixCherry login code`,
  );
}

export function paidEmail(p: { eventName: string; description: string; amountCents: number; receiptNo: string; eventId: string }) {
  return layout(
    "Payment received",
    [`Thank you. We received ${formatMoney(p.amountCents)} for "${p.eventName}" (${p.description}).`, `Receipt no. ${p.receiptNo}.`],
    { label: "Open your event", url: `${APP_URL}/dashboard/events/${p.eventId}` },
    `Payment received: ${p.eventName}`,
  );
}

export function deletionWarningEmail(p: { eventName: string; deletionAt: Date; eventId: string; photos: number }) {
  return layout(
    `Your photos will be deleted on ${formatDate(p.deletionAt)}`,
    [
      `"${p.eventName}" has ${p.photos.toLocaleString("en-MY")} photos. They will be deleted permanently on ${formatDate(p.deletionAt)}.`,
      "Download the full album before then, or add more storage days from your event page.",
    ],
    { label: "Download the album", url: `${APP_URL}/dashboard/events/${p.eventId}` },
  );
}

export function deletedEmail(p: { eventName: string }) {
  return layout(`"${p.eventName}" photos were deleted`, [
    "The storage period for this event has ended and its photos have been deleted permanently.",
    "Thank you for using PixCherry. We'd love to help with your next event.",
  ]);
}
