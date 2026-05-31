-- Migration 004: Add pancit_large column to the stock table
--
-- The "Pancit Large Trays" stock line is referenced throughout the app
-- (types.ts Stock, StockManager, App.tsx deductions, utils.getAvailable),
-- but the column was never added to the `stock` table — migration 001 added
-- the pork/noodle/veg columns and the base table only had pancit_full/half.
--
-- Result: any stock upsert that includes pancit_large is rejected wholesale
-- with PGRST204 ("Could not find the 'pancit_large' column"), so ALL stock
-- updates fail, not just pancit. This adds the missing column.

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS pancit_large INTEGER NOT NULL DEFAULT 0;
