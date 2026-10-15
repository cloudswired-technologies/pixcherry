-- One phone, one roll, take two. A single hash broke when one browser reported a
-- slightly different value (Chrome vs Edge on the same Android), and IPv6 privacy
-- addresses change during the day. Keep the device signals separately so they can
-- match loosely, and the network as an IPv6 /64 prefix (stable for one Wi-Fi / phone).
alter table guests add column device_info jsonb;
alter table guests add column net_hash text;
create index guests_net_idx on guests (event_id, net_hash) where net_hash is not null;
