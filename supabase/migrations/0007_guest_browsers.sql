-- One guest, several browsers on the same phone (e.g. the QR scanner opened Edge,
-- later they used Chrome). "Welcome back, Yaya?" adds that browser's key here
-- instead of creating a second Yaya.
alter table guests add column extra_token_hashes text[] not null default '{}';
