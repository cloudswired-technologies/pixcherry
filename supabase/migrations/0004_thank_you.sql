-- Thank-you note from the hosts, shown on the recap page after the event.
alter table events add column thank_you text not null default '' check (length(thank_you) <= 1000);
