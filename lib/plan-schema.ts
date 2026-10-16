// Every package setting lives here. The admin plan form, the event override
// form, the pricing cards and the limit checks all read this list, so adding a
// setting = adding one entry (plus the code that enforces it).

export type LimitKey =
  | "photos_per_guest"
  | "max_photos"
  | "max_guests"
  | "max_file_mb"
  | "retention_days"
  | "upload_hours_after_event";

export type FeatureKey =
  | "guest_album_download"
  | "custom_branding"
  | "hide_powered_by"
  | "moderation"
  | "slideshow"
  | "camera"
  | "wishes"
  | "voting"
  | "missions"
  | "tags";

/** `derived`: worked out from other limits, not typed in by the admin. */
export const LIMITS: { key: LimitKey; label: string; help: string; min: number; max: number; fallback: number; unit: string; pricing?: (n: number) => string; derived?: boolean }[] = [
  { key: "photos_per_guest", label: "Photos per guest", help: "How many photos one guest (one phone) can upload.", min: 1, max: 10000, fallback: 20, unit: "photos", pricing: (n) => `${n.toLocaleString("en-MY")} photos per guest` },
  { key: "max_photos", label: "Photos per event", help: "Automatic: guests × photos per guest.", min: 10, max: 10000000, fallback: 2000, unit: "photos", pricing: (n) => `Up to ${n.toLocaleString("en-MY")} photos`, derived: true },
  { key: "max_guests", label: "Guests per event", help: "How many phones can join and upload.", min: 1, max: 100000, fallback: 200, unit: "guests", pricing: (n) => `Up to ${n.toLocaleString("en-MY")} guests` },
  { key: "max_file_mb", label: "Max file size", help: "Largest single photo accepted (after the phone resizes it).", min: 1, max: 100, fallback: 15, unit: "MB" },
  { key: "retention_days", label: "Storage after the event", help: "Days the photos stay online after the event ends. Then they are deleted.", min: 1, max: 3650, fallback: 7, unit: "days", pricing: (n) => `Photos kept ${n} days after the event` },
  { key: "upload_hours_after_event", label: "Uploads stay open after the event", help: "Hours after the event ends that guests can still upload.", min: 0, max: 8760, fallback: 48, unit: "hours" },
];

export const FEATURES: { key: FeatureKey; label: string; help: string; pricing: string }[] = [
  { key: "guest_album_download", label: "Guests can download the whole album", help: "Otherwise only the organiser can download the ZIP. Guests can always save single photos.", pricing: "Guests can download the full album" },
  { key: "custom_branding", label: "Custom branding", help: "Organiser can set an accent colour and logo on the guest page.", pricing: "Your colours and logo" },
  { key: "hide_powered_by", label: "Hide \"Powered by PixCherry\"", help: "Removes the PixCherry footer from the guest page.", pricing: "No PixCherry branding" },
  { key: "moderation", label: "Photo approval", help: "Organiser can choose to approve photos before guests see them.", pricing: "Approve photos before they show" },
  { key: "slideshow", label: "Live slideshow", help: "Full-screen slideshow page for a projector or TV.", pricing: "Live slideshow for the big screen" },
  { key: "camera", label: "Snap with film looks", help: "Guests snap with their phone camera, then pick a film look, mission, hashtags and caption before sharing. Organiser can allow only new snaps (no gallery uploads).", pricing: "Snap with 12 film looks" },
  { key: "wishes", label: "Wishes wall", help: "Guests leave messages for the hosts, shown on the guest page and slideshow.", pricing: "Wishes wall for the hosts" },
  { key: "voting", label: "Hearts & leaderboard", help: "Guests heart photos; Top photos and Top snappers leaderboards.", pricing: "Hearts and live leaderboard" },
  { key: "tags", label: "Hashtags", help: "Guests tag photos with one tap (#reception, #family…); Highlights shows an album per hashtag.", pricing: "Hashtag albums" },
  { key: "missions", label: "Snap missions", help: "Organiser sets photo challenges; guests tick them off.", pricing: "Snap missions (photo challenges)" },
];

export type Limits = Record<LimitKey, number>;
export type Features = Record<FeatureKey, boolean>;

export const ADDON_KINDS: { kind: "retention_days" | "photos_per_guest" | "max_guests"; label: string }[] = [
  { kind: "retention_days", label: "Extra storage days" },
  { kind: "photos_per_guest", label: "Extra photos per guest" },
  { kind: "max_guests", label: "Extra guests" },
];

export type AddonKind = (typeof ADDON_KINDS)[number]["kind"];

export function normaliseLimits(raw: unknown): Limits {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as Limits;
  for (const l of LIMITS) {
    const n = Number(o[l.key]);
    out[l.key] = Number.isFinite(n) ? Math.min(l.max, Math.max(l.min, Math.round(n))) : l.fallback;
  }
  return out;
}

export function normaliseFeatures(raw: unknown): Features {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as Features;
  for (const f of FEATURES) out[f.key] = o[f.key] === true;
  return out;
}

export type QualityPreset = { name: string; max_px: number | null; jpeg_quality: number };

/** Every package gets the same quality now (sharp, fast to upload); kept for old snapshots. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function qualityLabel(_q?: QualityPreset) {
  return "Sharp, full-quality photos (up to 3072 px)";
}
