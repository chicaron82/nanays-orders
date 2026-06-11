-- Migration 010: Add goodwill discount columns to the orders table
--
-- One mechanism, many reasons: a storm pushes an order to a later date, a
-- repeat customer earns a thank-you. The discount is percent OR flat, with a
-- free-text label carrying the human explanation ("moved date 🙏").
--
-- type + value are stored rather than a precomputed amount so that editing the
-- order's items re-derives a percentage correctly. discountAmount() in
-- lib/utils applies it (clamped so the total never goes below $0); the stored
-- order total is net of the discount, so balances, deposits, tips, revenue and
-- the outstanding card all inherit it without changes.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_label TEXT;
