-- Demo albums (pixcherry.com/demo): ready-made events anyone can try with two phones.
-- They never expire. What visitors add (photos, wishes, hearts, reports, their guest
-- rows) is cleared 24 hours later (lib/demo.ts expireDemoContent); the sample photos
-- belong to seed guests and stay.
alter table events add column is_demo boolean not null default false;
alter table events add column demo_key text unique check (demo_key ~ '^[a-z0-9-]{2,30}$');
alter table guests add column is_seed boolean not null default false;
