-- One phone, one roll. Cookies belong to a browser, so a second browser on the
-- same phone used to become a second guest with a fresh quota. Joining now
-- checks several signals together: same network (ip_hash) + same device
-- signature (screen, GPU, cores… hashed on the phone), and same name.
alter table guests add column device_hash text;
-- Set when someone on a matching phone said "I'm someone else" (organiser can review/merge).
alter table guests add column same_phone_as uuid references guests(id) on delete set null;
create index guests_device_idx on guests (event_id, device_hash) where device_hash is not null;

-- Organiser switch: strict (default) = a matching phone must continue as the first guest.
alter table events add column one_phone_one_roll boolean not null default true;
