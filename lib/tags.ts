// Hashtags on photos. Stored without "#", lowercase, letters/digits/underscore.

export const DEFAULT_TAGS = ["ceremony", "reception", "family", "friends", "food", "selfie", "dancefloor", "details"];
export const MAX_TAGS_PER_PHOTO = 5;

export function cleanTag(raw: unknown) {
  const t = String(raw ?? "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 24);
  return t.length >= 2 ? t : null;
}

export function cleanTags(raw: unknown, max = MAX_TAGS_PER_PHOTO) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : [];
  return [...new Set(list.map(cleanTag).filter((t): t is string => !!t))].slice(0, max);
}

export function suggestedTags(e: { suggested_tags: string[] | null }) {
  return e.suggested_tags?.length ? e.suggested_tags : DEFAULT_TAGS;
}
