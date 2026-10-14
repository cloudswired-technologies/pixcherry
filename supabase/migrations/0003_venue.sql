-- Venue shown under the event name on the guest page ("12 July 2026 · The Majestic Hotel").
alter table events add column venue text not null default '' check (length(venue) <= 120);
