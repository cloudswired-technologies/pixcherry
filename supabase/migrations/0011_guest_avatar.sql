-- Optional selfie a guest adds when joining, so the hosts can tell whose photos are whose.
-- Stored under ev/<event>/avatars/, so it is deleted with the event's photos.
alter table guests add column avatar_key text;
