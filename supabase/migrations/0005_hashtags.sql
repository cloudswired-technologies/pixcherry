-- Hashtags: guests tag photos with one tap when sharing; Highlights shows one
-- album per hashtag. Organisers can change the suggested tags.
alter table photos add column tags text[] not null default '{}';
create index photos_tags_idx on photos using gin (tags);
alter table events add column suggested_tags text[] not null default '{}';

-- Available on every package by default (admin can still switch it off per package).
update plans set features = '{"tags":true}'::jsonb || features;
