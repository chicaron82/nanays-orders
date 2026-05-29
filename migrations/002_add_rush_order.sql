-- Migration 002: Add rush_order column to orders table
--
-- The rush_order feature (priority handling fee) was implemented in the
-- frontend but the backing column was never added to the schema.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rush_order BOOLEAN NOT NULL DEFAULT FALSE;
