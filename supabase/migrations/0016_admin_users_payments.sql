-- Admin tools: suspend an organiser (they can't log in; their albums keep working for guests),
-- a private admin note per organiser, and refunds recorded against a payment (the money itself is
-- refunded in the CHIP dashboard).

alter table users add column suspended_at timestamptz;
alter table users add column suspended_reason text check (length(suspended_reason) <= 300);
alter table users add column admin_note text check (length(admin_note) <= 2000);

alter table purchases add column refund_cents int check (refund_cents > 0);
alter table purchases add column refunded_at timestamptz;
alter table purchases add column refund_note text check (length(refund_note) <= 500);
alter table purchases add constraint purchases_refund_within_amount
  check (refund_cents is null or (refund_cents <= amount_cents and refunded_at is not null));

create index purchases_paid_at_idx on purchases (paid_at desc) where status = 'paid';
create index users_created_idx on users (created_at desc);
