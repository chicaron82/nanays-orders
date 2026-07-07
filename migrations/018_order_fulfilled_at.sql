-- 018: the fulfillment axis for orders. `fulfilled_at` (nullable timestamptz) records WHEN an
-- order was picked up / delivered; null = not yet fulfilled. This is independent of payment
-- (`payment_status`), so an order crosses off the calendar only when BOTH conditions hold:
-- paid AND fulfilled. A paid-not-delivered order stays open (you owe them food); a
-- delivered-not-paid order stays open (they owe you money).
--
-- Deliberately SEPARATE from the legacy `order_status = 'Fulfilled'` value (pre-June-2026
-- hand-flipped rows): those grandfather cleanly as done, while only orders marked via the new
-- flow run the two-condition rule. No date-cutoff guessing — legacy vs modern is structural.
-- Idempotent.
alter table public.orders
  add column if not exists fulfilled_at timestamptz;

comment on column public.orders.fulfilled_at is
  'When the order was picked up / delivered (null = not yet). Modern fulfillment axis; the calendar crosses an order off only when paid AND fulfilled. Legacy order_status=Fulfilled rows stay done regardless. See src/components/calendar/OrderChip.tsx.';
