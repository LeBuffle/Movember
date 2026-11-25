-- =========================================================================
-- DEFI Movember — refunds (story 2.8)
--
-- A refund is a SECOND movement, never a correction of the first. That is
-- what a book of accounts does, and it is what makes reconciliation with the
-- Stripe statement possible — Stripe records it exactly the same way
-- (architecture D12).
--
-- Which means the payment row keeps its amounts untouched forever, and a new
-- row of kind `refund` records the money going back out.
-- =========================================================================

-- The refund's own identifier at Stripe.
--
-- A refund row cannot carry the original `stripe_payment_intent_id`: that
-- column is unique, and it belongs to the payment. So the refund gets its
-- own, and its own unique constraint — which is what makes the operation
-- impossible to replay (story 2.8 AC 6). The database refuses the second
-- attempt; no check in the application could do it reliably, because two
-- clicks a second apart would both pass it.
alter table public.payments
  add column if not exists stripe_refund_id text;

comment on column public.payments.stripe_refund_id is
  'Set on rows of kind `refund` only. Unique: what makes a refund unrepeatable.';

create unique index if not exists payments_refund_unique
  on public.payments (stripe_refund_id)
  where stripe_refund_id is not null;

-- A refund row must name the refund it records, and a payment row must not.
-- Without this, a refund written by hand with no identifier would slip past
-- the unique index above — the one guard that stops it happening twice.
alter table public.payments
  add constraint payments_refund_has_identifier check (
    (kind = 'refund') = (stripe_refund_id is not null)
  );
