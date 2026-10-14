-- PixCherry schema. All access goes through the Next.js server / worker with a
-- privileged role; anon/authenticated (Supabase API roles) get nothing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users / auth
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text,
  phone text,
  is_admin boolean not null default false,
  session_version int not null default 1,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index login_codes_email_idx on login_codes (email, created_at desc);

-- ---------------------------------------------------------------- packages
create table quality_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_px int check (max_px is null or max_px between 640 and 12000), -- null = keep original size
  jpeg_quality int not null default 85 check (jpeg_quality between 50 and 100),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 0),
  quality_preset_id uuid not null references quality_presets(id),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  highlights text[] not null default '{}', -- extra marketing lines on the pricing card
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_quality_idx on plans (quality_preset_id);

create table plan_addons (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('retention_days','photos_per_guest','max_photos','max_guests')),
  name text not null,
  amount int not null check (amount > 0),
  price_cents int not null check (price_cents >= 0),
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  percent_off int check (percent_off between 1 and 100),
  amount_off_cents int check (amount_off_cents > 0),
  plan_id uuid references plans(id) on delete set null,
  max_uses int check (max_uses > 0),
  used_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_cents is null))
);
create index promo_codes_plan_idx on promo_codes (plan_id);

-- ---------------------------------------------------------------- events
create table events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]{8,32}$'),
  name text not null check (length(name) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at >= starts_at),
  cover_key text,
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_key text,
  ask_guest_name boolean not null default true,
  uploads_enabled boolean not null default true,
  require_approval boolean not null default false, -- only honoured when the plan has the moderation feature
  plan_id uuid references plans(id) on delete set null,
  plan_snapshot jsonb,          -- plan as paid: {code,name,price_cents,quality:{...},limits,features}
  addon_totals jsonb not null default '{}'::jsonb, -- {retention_days: 7, ...} summed from paid add-ons
  overrides jsonb not null default '{}'::jsonb,    -- admin per-event overrides, win over everything
  paid_at timestamptz,
  deletion_at timestamptz,      -- set on payment / when limits or dates change
  warned_at timestamptz,
  purged_at timestamptz,
  photo_count int not null default 0,   -- ready + review photos
  slot_count int not null default 0,    -- photos counting against max_photos (pending → ready/review)
  guest_count int not null default 0,
  bytes_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_idx on events (owner_id, created_at desc);
create index events_plan_idx on events (plan_id);
create index events_deletion_idx on events (deletion_at) where purged_at is null and paid_at is not null;

create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text check (length(name) <= 60),
  token_hash text not null unique,
  ip_hash text,
  upload_count int not null default 0, -- slots reserved or used (pending + uploaded + ready + review)
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index guests_event_idx on guests (event_id, created_at desc);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  uploader text not null default 'guest' check (uploader in ('guest','organiser')),
  status text not null default 'pending'
    check (status in ('pending','uploaded','processing','ready','review','rejected','failed','deleted')),
  content_type text not null,
  declared_bytes int not null,
  bytes int,                      -- full + md + sm after processing
  width int,
  height int,
  taken_at timestamptz,
  error text,
  attempts int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  ready_at timestamptz
);
create index photos_event_idx on photos (event_id, status, created_at desc);
create index photos_guest_idx on photos (guest_id);
create index photos_queue_idx on photos (uploaded_at) where status in ('uploaded','processing');
create index photos_pending_idx on photos (created_at) where status = 'pending';

-- ---------------------------------------------------------------- payments
create sequence receipt_seq;

create table purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('plan','upgrade','addon')),
  plan_id uuid references plans(id) on delete set null,
  addon_id uuid references plan_addons(id) on delete set null,
  promo_code_id uuid references promo_codes(id) on delete set null,
  description text not null,
  subtotal_cents int not null,
  discount_cents int not null default 0,
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  chip_purchase_id text unique,
  receipt_no text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index purchases_event_idx on purchases (event_id, created_at desc);
create index purchases_user_idx on purchases (user_id);
create index purchases_plan_idx on purchases (plan_id);
create index purchases_addon_idx on purchases (addon_id);
create index purchases_promo_idx on purchases (promo_code_id);

-- ---------------------------------------------------------------- platform
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);
create index audit_log_actor_idx on audit_log (actor_id);

create table email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on email_log (created_at desc);

create table webhook_log (
  id bigint generated always as identity primary key,
  source text not null,
  ref text,
  ok boolean not null,
  note text,
  created_at timestamptz not null default now()
);
create index webhook_log_created_idx on webhook_log (created_at desc);

-- ---------------------------------------------------------------- lock down
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------- seed
insert into quality_presets (name, max_px, jpeg_quality, sort) values
  ('Standard (2048 px)', 2048, 80, 1),
  ('HD (3000 px)', 3000, 85, 2),
  ('Original', null, 92, 3);

insert into plans (code, name, description, price_cents, quality_preset_id, limits, features, is_featured, sort)
select 'basic', 'Basic', 'Everything a wedding or party needs.', 5000, q.id,
  '{"photos_per_guest":20,"max_photos":2000,"max_guests":200,"max_file_mb":15,"retention_days":7,"upload_hours_after_event":48}',
  '{"guest_album_download":false,"custom_branding":false,"hide_powered_by":false,"moderation":false,"slideshow":false}',
  true, 1
from quality_presets q where q.name = 'Standard (2048 px)';

insert into plans (code, name, description, price_cents, quality_preset_id, limits, features, sort)
select 'premium', 'Premium', 'Full-quality photos, longer storage and your own branding.', 12000, q.id,
  '{"photos_per_guest":50,"max_photos":10000,"max_guests":1000,"max_file_mb":30,"retention_days":30,"upload_hours_after_event":168}',
  '{"guest_album_download":true,"custom_branding":true,"hide_powered_by":true,"moderation":true,"slideshow":true}',
  2
from quality_presets q where q.name = 'Original';

insert into plan_addons (kind, name, amount, price_cents, sort) values
  ('retention_days', '+7 days storage', 7, 1500, 1),
  ('photos_per_guest', '+20 photos per guest', 20, 1500, 2),
  ('max_photos', '+2,000 photos', 2000, 2000, 3);

insert into settings (key, value) values
  ('warn_days_before_delete', '3'),
  ('upload_rate_per_minute', '30'),
  ('company', '{"name":"Cloudswired Technologies","address":"Johor, Malaysia","email":"support@pixcherry.com","reg_no":""}');
