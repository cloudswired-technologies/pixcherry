-- Comments on photos (Instagram style): joined guests comment, the commenter
-- or the organiser can remove one. Deleted with the event's photos.
create table photo_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  guest_id uuid references guests(id) on delete set null,
  name text,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index photo_comments_photo_idx on photo_comments (photo_id, created_at);
create index photo_comments_event_idx on photo_comments (event_id, created_at desc);
alter table photos add column comment_count int not null default 0;

update plans set features = '{"comments":true}'::jsonb || features;
-- Events already paid keep their plan snapshot; give them the new guest features too.
update events set plan_snapshot = jsonb_set(plan_snapshot, '{features}', '{"comments":true,"tags":true}'::jsonb || coalesce(plan_snapshot->'features', '{}'::jsonb))
  where plan_snapshot is not null and purged_at is null;

-- Memorable event links (app.pixcherry.com/aina-hakim). Old links keep working
-- after a rename; "new private link" drops them.
alter table events drop constraint events_slug_check;
alter table events add constraint events_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');
alter table events add column old_slugs text[] not null default '{}';
create index events_old_slugs_idx on events using gin (old_slugs);
