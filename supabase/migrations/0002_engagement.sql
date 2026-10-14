-- Engagement: snap missions, wishes, votes, disposable-camera mode.

create table event_missions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  emoji text check (length(emoji) <= 16),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index event_missions_event_idx on event_missions (event_id, sort, created_at);

alter table photos add column mission_id uuid references event_missions(id) on delete set null;
alter table photos add column vote_count int not null default 0;
create index photos_mission_idx on photos (mission_id);
create index photos_top_idx on photos (event_id, vote_count desc, ready_at desc) where status = 'ready';
create index photos_guest_ready_idx on photos (guest_id, ready_at desc) where status = 'ready';

create table photo_votes (
  photo_id uuid not null references photos(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, guest_id)
);
create index photo_votes_guest_idx on photo_votes (guest_id);

create table wishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  name text check (length(name) <= 60),
  message text not null check (length(message) between 1 and 500),
  photo_id uuid references photos(id) on delete set null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index wishes_event_idx on wishes (event_id, created_at desc);
create index wishes_guest_idx on wishes (guest_id);
create index wishes_photo_idx on wishes (photo_id);

-- Disposable camera: guests can only use the in-app camera (no gallery uploads).
alter table events add column camera_only boolean not null default false;

do $$
declare t text;
begin
  for t in select unnest(array['event_missions','photo_votes','wishes']) loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.event_missions, public.photo_votes, public.wishes from anon, authenticated';
  end if;
end $$;

-- New package features. Existing values win (admin edits are kept).
update plans set features = '{"wishes":true,"voting":true,"camera":true,"missions":false}'::jsonb || features where code = 'basic';
update plans set features = '{"wishes":true,"voting":true,"camera":true,"missions":true}'::jsonb || features where code <> 'basic';
