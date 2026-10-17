import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { one, q } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { APP_URL } from "@/lib/env";
import { coverUrl, slugTaken, uniqueSlug } from "@/lib/events";
import type { Overrides } from "@/lib/limits";
import { listPlans, snapshot } from "@/lib/plans";
import { deleteObject, deletePrefix, photoKeys, putObject } from "@/lib/storage";
import { cleanTags } from "@/lib/tags";

// Demo albums (pixcherry.com/demo). Each one is a ready-made Exclusive event with
// a few sample photos by named "seed" guests. Visitors join and snap like real
// guests; whatever they add is cleared DEMO_HOURS later, so the albums stay tidy
// and the next visitor gets a fresh roll. Demos never expire.

export const DEMO_HOURS = 24;
/** Shots per phone in a demo (the real Exclusive package gives more). */
export const DEMO_SHOTS = 10;
/** Far-future end date: a demo is always live. */
const DEMO_END = "2099-12-31T15:59:59Z";

type SeedPhoto = { file: string; by: string; caption?: string; tags?: string[]; mission?: number };
export type DemoSpec = {
  key: string;
  slug: string;
  kind: string;
  emoji: string;
  name: string;
  venue: string;
  description: string;
  /** One line for the demo page card. */
  blurb: string;
  tags: string[];
  missions: { emoji: string; title: string }[];
  photos: SeedPhoto[];
  wishes: { by: string; message: string }[];
};

// Sample photos live in public/demo/ (2048 px, metadata stripped).
export const DEMOS: DemoSpec[] = [
  {
    key: "wedding",
    slug: "demo-wedding",
    kind: "Wedding",
    emoji: "💍",
    name: "Majlis Perkahwinan Aina & Hakim",
    venue: "Laman Seri, Johor Bahru",
    description: "Terima kasih kerana meraikan kami! Snap and share every moment 🤍",
    blurb: "Akad, bersanding and the buffet line: every guest's angle in one album.",
    tags: ["bersanding", "makan", "family", "friends", "pelamin"],
    missions: [
      { emoji: "🤳", title: "Selfie with the pengantin" },
      { emoji: "👨‍👩‍👧", title: "Family photo" },
      { emoji: "🍛", title: "The food you loved" },
      { emoji: "😂", title: "A big candid laugh" },
    ],
    photos: [
      { file: "wedding-1.jpg", by: "Farah", caption: "Seri pengantin 🤍", tags: ["bersanding", "pelamin"] },
      { file: "wedding-2.jpg", by: "Hafiz", caption: "Nasi minyak round two 😋", tags: ["makan"], mission: 2 },
      { file: "wedding-3.jpg", by: "Mak Long", caption: "Semua dah sampai!", tags: ["family"], mission: 1 },
    ],
    wishes: [
      { by: "Farah", message: "Selamat pengantin baru Aina & Hakim! Semoga bahagia hingga ke Jannah 🤍" },
      { by: "Hafiz", message: "Congrats bro! Makanan sedap gila, terbaik 🔥" },
    ],
  },
  {
    key: "birthday",
    slug: "demo-birthday",
    kind: "Birthday",
    emoji: "🎂",
    name: "Adam's 6th Birthday Party",
    venue: "Seri Kembangan, Selangor",
    description: "Thank you for coming to celebrate Adam! Share your photos of the party 🎈",
    blurb: "Candles, balloons and a room full of kids, all captured by the parents.",
    tags: ["cake", "games", "friends", "family", "balloons"],
    missions: [
      { emoji: "🎂", title: "Blowing the candles" },
      { emoji: "🎈", title: "Balloon fun" },
      { emoji: "🤳", title: "Selfie with Adam" },
      { emoji: "🎁", title: "Present time" },
    ],
    photos: [
      { file: "birthday-1.jpg", by: "Aunty Mira", caption: "Happy birthday Adam! 🎉", tags: ["cake", "friends"], mission: 0 },
      { file: "birthday-2.jpg", by: "Papa Adam", caption: "Cake time 🎂", tags: ["cake", "family"] },
      { file: "birthday-3.jpg", by: "Cikgu Nurul", caption: "Full house!", tags: ["games"], mission: 1 },
    ],
    wishes: [
      { by: "Aunty Mira", message: "Happy 6th birthday Adam! Grow up kind and strong 💙" },
      { by: "Cikgu Nurul", message: "Selamat hari jadi Adam! Thank you for inviting us 🎈" },
    ],
  },
  {
    key: "conference",
    slug: "demo-conference",
    kind: "Conference",
    emoji: "🎤",
    name: "National Technology Summit 2026",
    venue: "KL Convention Hall",
    description: "Share your best shots from the keynotes, panels and networking. Top snappers make the big screen!",
    blurb: "Keynotes, panels and coffee-break networking, from every seat in the hall.",
    tags: ["keynote", "panel", "networking", "booth", "speakers"],
    missions: [
      { emoji: "🎤", title: "The keynote speaker" },
      { emoji: "🤝", title: "New connection selfie" },
      { emoji: "☕", title: "Coffee break moment" },
      { emoji: "🏢", title: "Your favourite booth" },
    ],
    photos: [
      { file: "conference-1.jpg", by: "Daniel Tan", caption: "Opening keynote 🚀", tags: ["keynote"], mission: 0 },
      { file: "conference-2.jpg", by: "Siti Aminah", caption: "Great insights on resilience", tags: ["panel", "speakers"] },
      { file: "conference-3.jpg", by: "Raj Kumar", caption: "Coffee and connections ☕", tags: ["networking"], mission: 2 },
    ],
    wishes: [
      { by: "Daniel Tan", message: "Brilliant line-up this year. See you in 2027!" },
      { by: "Siti Aminah", message: "Terbaik! Banyak ilmu baru hari ini 👏" },
    ],
  },
  {
    key: "familyday",
    slug: "demo-family-day",
    kind: "Family Day",
    emoji: "🏖️",
    name: "Family Day 2026",
    venue: "Desaru, Johor",
    description: "Sun, sand and the whole team! Snap the fun and share it here 🌴",
    blurb: "The whole company and their families at the beach, games and all.",
    tags: ["beach", "team", "kids", "games", "makan"],
    missions: [
      { emoji: "👨‍👩‍👧‍👦", title: "Whole team photo" },
      { emoji: "🏃", title: "Telematch action" },
      { emoji: "🏖️", title: "Beach moment" },
      { emoji: "🍉", title: "Makan time" },
    ],
    photos: [
      { file: "familyday-1.jpg", by: "Kak Ida", caption: "Team photo, done! 🙌", tags: ["team"], mission: 0 },
      { file: "familyday-2.jpg", by: "Abang Zul", caption: "Budak-budak paling happy 😄", tags: ["kids", "beach"], mission: 2 },
      { file: "familyday-3.jpg", by: "Wani", caption: "Glamping corner ⛺", tags: ["beach"] },
    ],
    wishes: [
      { by: "Kak Ida", message: "Best family day ever! Thank you to the organising team 🙏" },
      { by: "Abang Zul", message: "Next year kita buat lagi! 🏖️" },
    ],
  },
  {
    key: "convocation",
    slug: "demo-convocation",
    kind: "Convocation",
    emoji: "🎓",
    name: "Convocation Day 2025",
    venue: "Main Hall",
    description: "Congratulations, graduates! Share every proud moment with family and friends 🎓",
    blurb: "On stage, with the family, with the batch: every proud moment in one place.",
    tags: ["graduates", "family", "stage", "friends", "flowers"],
    missions: [
      { emoji: "🎓", title: "On stage" },
      { emoji: "👨‍👩‍👧", title: "Family with the graduate" },
      { emoji: "🧑‍🎓", title: "Batchmates group photo" },
      { emoji: "💐", title: "Flowers and gifts" },
    ],
    photos: [
      { file: "convocation-1.jpg", by: "Aiman", caption: "Class of 2025! 🎓", tags: ["graduates", "friends"], mission: 2 },
      { file: "convocation-2.jpg", by: "Mama", caption: "Proud moment ✨", tags: ["stage"], mission: 0 },
      { file: "convocation-3.jpg", by: "Kak Long", caption: "Satu family datang 💐", tags: ["family"], mission: 1 },
    ],
    wishes: [
      { by: "Mama", message: "Tahniah! Semua penat lelah berbaloi 🎓" },
      { by: "Aiman", message: "Congrats everyone, proud of our batch!" },
    ],
  },
  {
    key: "raya",
    slug: "demo-hari-raya",
    kind: "Hari Raya",
    emoji: "🌙",
    name: "Rumah Terbuka Hari Raya 2026",
    venue: "Bandar Baru Bangi, Selangor",
    description: "Selamat Hari Raya Aidilfitri, maaf zahir dan batin! Jom kongsi gambar raya di sini 🌙",
    blurb: "Baju sedondon, lemang and rendang: the open house through every guest's eyes.",
    tags: ["raya", "makan", "family", "sedondon", "duitraya"],
    missions: [
      { emoji: "👨‍👩‍👧‍👦", title: "Family photo in baju raya" },
      { emoji: "🍛", title: "Juadah raya" },
      { emoji: "🧧", title: "Duit raya moment" },
      { emoji: "🤳", title: "Selfie with tuan rumah" },
    ],
    photos: [
      { file: "raya-1.jpg", by: "Pak Ngah", caption: "Raya sedondon 💚", tags: ["family", "sedondon"], mission: 0 },
      { file: "raya-2.jpg", by: "Alya", caption: "Lemang dengan rendang 😋", tags: ["makan"] },
      { file: "raya-3.jpg", by: "Mak Su", caption: "Juadah dah siap!", tags: ["makan"], mission: 1 },
    ],
    wishes: [
      { by: "Pak Ngah", message: "Selamat Hari Raya, maaf zahir dan batin 🌙" },
      { by: "Alya", message: "Rendang Mak Su terbaik! 😋" },
    ],
  },
];

const demoOverrides = (): Overrides => ({
  limits: { photos_per_guest: DEMO_SHOTS },
  // A demo shows PixCherry as it is: our branding, not a custom one.
  features: { hide_powered_by: false, custom_branding: false },
  note: `Demo album: visitors' photos clear after ${DEMO_HOURS} hours.`,
});

async function seedImage(file: string) {
  // The standalone server runs from its release folder, which has public/ next to it.
  try {
    return await readFile(join(process.cwd(), "public", "demo", file));
  } catch {
    const r = await fetch(`${APP_URL}/demo/${file}`);
    if (!r.ok) throw new Error(`demo photo ${file} missing (${r.status})`);
    return Buffer.from(await r.arrayBuffer());
  }
}

export type SeedReport = { key: string; slug: string; created: boolean; photos: number };

/** Creates the missing demo albums and refreshes the text of existing ones. Safe to run again. */
export async function seedDemos(ownerId: string): Promise<SeedReport[]> {
  const plans = await listPlans(false);
  const plan = plans.find((p) => p.code === "exclusive") ?? [...plans].sort((a, b) => b.price_cents - a.price_cents)[0];
  if (!plan) throw new Error("No package to base the demos on");
  const out: SeedReport[] = [];
  for (const s of DEMOS) out.push(await seedOne(s, ownerId, plan));
  return out;
}

async function seedOne(s: DemoSpec, ownerId: string, plan: Awaited<ReturnType<typeof listPlans>>[number]): Promise<SeedReport> {
  const tags = cleanTags(s.tags, 10);
  let ev = await one<{ id: string; slug: string }>("select id, slug from events where demo_key = $1", [s.key]);
  const created = !ev;
  if (!ev) {
    const slug = (await slugTaken(s.slug)) ? await uniqueSlug() : s.slug;
    ev = await one<{ id: string; slug: string }>(
      `insert into events (owner_id, slug, name, description, venue, suggested_tags, starts_at, ends_at, plan_id, plan_snapshot, overrides, paid_at, is_demo, demo_key)
       values ($1, $2, $3, $4, $5, $6, now() - interval '1 day', $7, $8, $9, $10, now(), true, $11) returning id, slug`,
      [ownerId, slug, s.name, s.description, s.venue, tags, DEMO_END, plan.id, JSON.stringify(snapshot(plan)), JSON.stringify(demoOverrides()), s.key],
    );
  } else {
    await q(
      `update events set name = $2, description = $3, venue = $4, suggested_tags = $5, ends_at = $6, plan_id = $7, plan_snapshot = $8, overrides = $9,
         is_demo = true, uploads_enabled = true, deletion_at = null, warned_at = null, updated_at = now()
       where id = $1`,
      [ev.id, s.name, s.description, s.venue, tags, DEMO_END, plan.id, JSON.stringify(snapshot(plan)), JSON.stringify(demoOverrides())],
    );
  }
  const id = ev!.id;
  const seeded = await one<{ n: number }>("select count(*)::int as n from photos p join guests g on g.id = p.guest_id where p.event_id = $1 and g.is_seed and p.status <> 'deleted'", [id]);
  if (seeded && seeded.n > 0) return { key: s.key, slug: ev!.slug, created, photos: 0 };

  // Missions (kept if they exist, so photo links stay valid).
  let missions = await q<{ id: string }>("select id from event_missions where event_id = $1 order by sort, created_at", [id]);
  if (!missions.length) {
    for (const [i, m] of s.missions.entries()) {
      await q("insert into event_missions (event_id, title, emoji, sort) values ($1, $2, $3, $4)", [id, m.title, m.emoji, i]);
    }
    missions = await q<{ id: string }>("select id from event_missions where event_id = $1 order by sort, created_at", [id]);
  }

  // Seed guests: one per name, never cleared.
  const guests = new Map<string, string>();
  for (const name of new Set([...s.photos.map((p) => p.by), ...s.wishes.map((w) => w.by)])) {
    const g = await one<{ id: string }>(
      "insert into guests (event_id, name, token_hash, is_seed) values ($1, $2, $3, true) returning id",
      [id, name, sha256(randomToken())],
    );
    guests.set(name, g!.id);
  }

  // Photos go through the normal pipeline: the worker makes the previews.
  const photoIds: string[] = [];
  for (const p of s.photos) {
    const buf = await seedImage(p.file);
    const guestId = guests.get(p.by)!;
    const r = await one<{ id: string }>(
      `insert into photos (event_id, guest_id, content_type, declared_bytes, mission_id, tags, caption, approved_at)
       values ($1, $2, 'image/jpeg', $3, $4, $5, $6, now()) returning id`,
      [id, guestId, buf.length, p.mission !== undefined ? (missions[p.mission]?.id ?? null) : null, cleanTags(p.tags ?? []), p.caption ?? null],
    );
    await putObject(photoKeys(id, r!.id).incoming, buf, "image/jpeg");
    await q("update photos set status = 'uploaded', uploaded_at = now() where id = $1", [r!.id]);
    await q("update guests set upload_count = upload_count + 1 where id = $1", [guestId]);
    await q("update events set slot_count = slot_count + 1 where id = $1", [id]);
    photoIds.push(r!.id);
  }

  // Each seed guest hearts the others' photos, so "Most loved" has something to show.
  for (const [i, pid] of photoIds.entries()) {
    for (const [name, gid] of guests) {
      if (name === s.photos[i].by) continue;
      await q("insert into photo_votes (photo_id, guest_id) values ($1, $2) on conflict do nothing", [pid, gid]);
    }
    await q("update photos set vote_count = (select count(*) from photo_votes where photo_id = $1) where id = $1", [pid]);
  }

  for (const w of s.wishes) {
    await q("insert into wishes (event_id, guest_id, name, message) values ($1, $2, $3, $4)", [id, guests.get(w.by)!, w.by, w.message]);
  }
  await q("update events set guest_count = (select count(*) from guests where event_id = $1) where id = $1", [id]);

  // Cover: the first sample photo, cropped like an organiser's cover.
  const cover = await sharp(await seedImage(s.photos[0].file)).resize({ width: 1600, height: 900, fit: "cover" }).webp({ quality: 80 }).toBuffer();
  await putObject(`ev/${id}/cover.webp`, cover, "image/webp");
  await q("update events set cover_key = $2, updated_at = now() where id = $1", [id, `ev/${id}/cover.webp`]);
  return { key: s.key, slug: ev!.slug, created, photos: photoIds.length };
}

/**
 * Clears what visitors added to the demo albums more than DEMO_HOURS ago (or
 * everything, `now`): their photos and files, wishes, hearts, reports, and guest
 * rows with nothing left. Sample photos by seed guests stay. Returns counts.
 */
export async function expireDemoContent(opts: { now?: boolean; eventId?: string } = {}) {
  const cutoff = opts.now ? "now()" : `now() - interval '${DEMO_HOURS} hours'`;
  const scope = opts.eventId && /^[0-9a-f-]{36}$/.test(opts.eventId) ? opts.eventId : null;
  const demos = await q<{ id: string }>("select id from events where is_demo and purged_at is null and ($1::uuid is null or id = $1)", [scope]);
  let photos = 0;
  let guests = 0;
  for (const { id } of demos) {
    // Photos (any state) shared by visitors before the cutoff.
    const rows = await q<{ id: string; guest_id: string | null; status: string; bytes: string | null }>(
      `select p.id, p.guest_id, p.status, p.bytes from photos p left join guests g on g.id = p.guest_id
       where p.event_id = $1 and p.status <> 'deleted' and not coalesce(g.is_seed, false) and p.created_at < ${cutoff}`,
      [id],
    );
    for (const r of rows) {
      const done = await q("update photos set status = 'deleted' where id = $1 and status <> 'deleted' returning id", [r.id]);
      if (!done.length) continue;
      const counted = ["ready", "review"].includes(r.status);
      const holdsSlot = ["pending", "uploaded", "processing", "ready", "review"].includes(r.status);
      await q(
        `update events set photo_count = greatest(0, photo_count - $2), slot_count = greatest(0, slot_count - $3), bytes_used = greatest(0, bytes_used - $4) where id = $1`,
        [id, counted ? 1 : 0, holdsSlot ? 1 : 0, counted ? Number(r.bytes ?? 0) : 0],
      );
      if (holdsSlot && r.guest_id) await q("update guests set upload_count = greatest(0, upload_count - 1) where id = $1", [r.guest_id]);
      await deletePrefix(photoKeys(id, r.id).prefix).catch(() => {});
      await deleteObject(photoKeys(id, r.id).incoming).catch(() => {});
      photos++;
    }
    await q(
      `delete from wishes w where w.event_id = $1 and w.created_at < ${cutoff}
         and not exists (select 1 from guests g where g.id = w.guest_id and g.is_seed)`,
      [id],
    );
    await q(
      `delete from photo_votes v using photos p where p.id = v.photo_id and p.event_id = $1 and v.created_at < ${cutoff}
         and not exists (select 1 from guests g where g.id = v.guest_id and g.is_seed)`,
      [id],
    );
    await q(
      `delete from photo_reports r using photos p where p.id = r.photo_id and p.event_id = $1 and r.created_at < ${cutoff}
         and not exists (select 1 from guests g where g.id = r.guest_id and g.is_seed)`,
      [id],
    );
    await q(
      `update photos p set vote_count = (select count(*) from photo_votes v where v.photo_id = p.id),
         report_count = (select count(*) from photo_reports r where r.photo_id = p.id)
       where p.event_id = $1 and p.status <> 'deleted'`,
      [id],
    );
    // Visitors who joined before the cutoff and have nothing left in the album.
    const gone = await q<{ id: string; avatar_key: string | null }>(
      `delete from guests g where g.event_id = $1 and not g.is_seed and g.created_at < ${cutoff}
         and not exists (select 1 from photos p where p.guest_id = g.id and p.status <> 'deleted')
       returning g.id, g.avatar_key`,
      [id],
    );
    for (const g of gone) if (g.avatar_key) await deleteObject(g.avatar_key).catch(() => {});
    guests += gone.length;
    await q("update events set guest_count = (select count(*) from guests where event_id = $1) where id = $1", [id]);
  }
  return { albums: demos.length, photos, guests };
}

export type DemoCard = Omit<DemoSpec, "photos"> & { id: string; liveSlug: string; cover: string | null; photoCount: number; guestCount: number };

/** The demo albums that exist, in the page's order. */
export async function listDemoCards(): Promise<DemoCard[]> {
  const rows = await q<{ id: string; slug: string; demo_key: string; cover_key: string | null; updated_at: Date; photo_count: number; guest_count: number }>(
    "select id, slug, demo_key, cover_key, updated_at, photo_count, guest_count from events where is_demo and purged_at is null and paid_at is not null",
  );
  const byKey = new Map(rows.map((r) => [r.demo_key, r]));
  return DEMOS.flatMap((s) => {
    const r = byKey.get(s.key);
    return r ? [{ ...s, id: r.id, liveSlug: r.slug, cover: coverUrl(r), photoCount: r.photo_count, guestCount: r.guest_count }] : [];
  });
}
