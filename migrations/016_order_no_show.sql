-- Migration 016: no-show flag + reason on orders
--
-- A "no-show" is a customer who placed an order and never followed through. It's
-- recorded as a flavour of cancellation — marking one also sets order_status =
-- 'Cancelled', so all existing Cancelled handling (revenue, active counts, owing)
-- applies for free — plus this orthogonal flag, which drives the repeat-no-show
-- watchlist (match an incoming name/phone against past no-shows). The reason is
-- Christine's note on why it was flagged.
--
-- Idempotent: safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS no_show         boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS no_show_reason  text;
