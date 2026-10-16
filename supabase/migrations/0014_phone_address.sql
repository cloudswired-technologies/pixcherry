-- One phone, one roll, take three. Same-model phones on one venue Wi-Fi look identical,
-- and an IPv6 Wi-Fi gives every phone there the same /64, so neither the device signals
-- nor the network can tell two guests apart. The full IPv6 address can: both browsers of
-- one phone use the same address, two phones never do. IPv4 (one address for a whole
-- venue or for many telco customers) is never used to match phones.
-- addr_hash = the guest's latest IPv6 address (hashed), refreshed when they upload.
alter table guests add column addr_hash text;
create index guests_addr_idx on guests (event_id, addr_hash) where addr_hash is not null;

-- Albums already deleted: forget who their guests were too (lib/jobs.ts purgeEvent
-- now does this at deletion time). Counts stay.
delete from photo_reports r using photos p, events e where p.id = r.photo_id and e.id = p.event_id and e.purged_at is not null;
update photos p set report_count = 0, caption = null, tags = '{}'
  from events e where e.id = p.event_id and e.purged_at is not null;
update guests g set name = null, avatar_key = null, device_info = null, device_hash = null, ip_hash = null, net_hash = null, extra_token_hashes = '{}'
  from events e where e.id = g.event_id and e.purged_at is not null;
