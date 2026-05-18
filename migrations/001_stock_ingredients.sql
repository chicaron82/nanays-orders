-- Migration 001: Add ingredient tracking columns to stock table
--
-- Adds pork prep chain (frozen/thawed portions), noodle pack count,
-- and shared consumable status (carrots, Chinese celery) for the
-- fulfillability warning system.

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS pork_frozen   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pork_thawed   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS noodle_packs  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carrots_status TEXT    NOT NULL DEFAULT 'plenty'
    CONSTRAINT stock_carrots_status_check CHECK (carrots_status IN ('plenty', 'low', 'out')),
  ADD COLUMN IF NOT EXISTS celery_status  TEXT    NOT NULL DEFAULT 'plenty'
    CONSTRAINT stock_celery_status_check  CHECK (celery_status  IN ('plenty', 'low', 'out'));
