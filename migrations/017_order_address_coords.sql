-- Migration 017: cache geocoded coordinates for delivery addresses.
--
-- The order-details drive-time estimate geocodes the free-text address on the
-- fly. Capturing lat/lng when the address is picked from autocomplete makes the
-- estimate reliable (no re-geocode, no fuzzy miss) and lets a wrong pin be caught
-- at entry. Nullable by design: pickup orders and legacy/free-typed addresses
-- stay null and fall back to on-the-fly geocoding.
--
-- Idempotent: safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_lat NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_lng NUMERIC;
