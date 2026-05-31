-- Migration 006: Add custom_items column to the orders table
--
-- Custom items are ad-hoc one-off dishes (e.g. embutido) entered as
-- { name, price } objects, so they're stored as a JSON array. Every order save
-- now includes custom_items (defaulting to []), so this column must exist or
-- the whole upsert is rejected with PGRST204 — same failure mode as a missing
-- pancit_large / tip_amount. They flow into calcTotal -> total -> revenue, and
-- into an "Other" bucket in Insights.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS custom_items JSONB NOT NULL DEFAULT '[]'::jsonb;
