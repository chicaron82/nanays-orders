-- Migration 005: Add tip_amount column to the orders table
--
-- When an order is marked Paid for more than the total, the customer chose to
-- leave the overage as a tip (vs. taking change back). That decision can't be
-- derived from the numbers alone — a $43 payment on a $42.50 order is a tip,
-- but $50 on $42.50 is usually change owed — so the kept tip is stored here.
--
-- Used by tipAmount() in lib/utils (revenue counts total + tip; balance is
-- unaffected). 0 = paid exactly / change given / not paid.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC NOT NULL DEFAULT 0;
