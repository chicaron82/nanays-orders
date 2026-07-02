-- Migration 017: one-time legacy-pricing grace on orders
--
-- The 2026-07 price raise (mom-approved, fair-market recon) lands suddenly on
-- regulars, so sis can honor the OLD prices for one order per returning customer.
-- Stored as a boolean flag, NOT a dollar amount: legacyAmount() in lib/utils
-- re-derives subtotal(new) − subtotal(old) on every edit, so editing items can't
-- leave a stale figure (same philosophy as the percent discount). The confirmation
-- message shows the saved amount + that new prices apply next order.
--
-- Idempotent: safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS legacy_pricing boolean NOT NULL DEFAULT false;
