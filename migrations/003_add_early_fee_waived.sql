-- Migration 003: Add early_fee_waived column to orders table
--
-- The early-fulfillment fee is DERIVED at calculation time from pickup_time
-- (pickup before 11am, or delivery before noon — the extra hour covers a
-- delivery's prep + travel lead time). Nothing about "is this early" is stored;
-- it's recomputed live so it can never drift from the pickup time.
--
-- The only thing that needs persisting is Christine's override: when she's
-- happy to take an early order, she waives the fee. That decision lives here.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS early_fee_waived BOOLEAN NOT NULL DEFAULT FALSE;
