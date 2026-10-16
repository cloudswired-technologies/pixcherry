-- Keeping albums clean: the worker's AI check and guest reports.
--   flag: why a photo needs the host's eye
--     'ai'      AI says it looks like nudity: hidden (status 'review') until the host decides
--     'ai_soft' AI is unsure: stays visible, marked for the host
--     'report'  enough guests reported it: hidden until the host decides
--   nsfw: the AI's porn+hentai score (0–1), kept for tuning thresholds
--   approved_at: the host approved it; reports no longer hide it
alter table photos
  add column flag text check (flag in ('ai', 'ai_soft', 'report')),
  add column nsfw real,
  add column report_count int not null default 0,
  add column approved_at timestamptz;

create table photo_reports (
  photo_id uuid not null references photos(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, guest_id)
);
create index photo_reports_guest_idx on photo_reports (guest_id);
