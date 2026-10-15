// Event links: app.pixcherry.com/<slug>. Organisers pick a memorable one;
// shared by the server (validation) and the create/edit forms (preview).

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// Paths the app itself uses on the guest host, plus names that would confuse guests.
export const RESERVED = new Set([
  "e", "api", "_next", "admin", "dashboard", "login", "logout", "app", "www", "static", "assets", "icon", "icons",
  "manifest", "sw", "help", "about", "pricing", "terms", "privacy", "find", "join", "new", "settings", "pixcherry",
  "support", "contact", "favicon", "robots", "sitemap", "img", "cdn", "mail", "blog", "status", "account",
]);

/** "Aina & Hakim's Wedding" → "aina-hakims-wedding". */
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Why a slug can't be used (format only — the server also checks it's free), or null. */
export function slugProblem(s: string) {
  if (s.length < 3) return "Use at least 3 letters or numbers.";
  if (s.length > 40) return "Keep it under 40 characters.";
  if (!SLUG_RE.test(s) || s.includes("--")) return "Use only small letters, numbers and single dashes (no dash at the start or end).";
  if (RESERVED.has(s)) return "That word is reserved. Try another.";
  return null;
}
