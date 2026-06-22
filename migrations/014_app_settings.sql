-- Migration 014: app_settings — runtime store toggles
--
-- A single-row settings table the public request page reads (anon) and the
-- kitchen toggles (authenticated). First use: `accepting_requests` — when false,
-- the public page stops taking orders and points customers to Facebook Messenger
-- instead (their orders mostly arrive via a marketplace post link).
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS app_settings (
  id                 int         PRIMARY KEY DEFAULT 1,
  accepting_requests boolean     NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

-- Seed the single row.
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Anon SELECT: the public request page reads the toggle.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_settings' AND policyname = 'Public read of app_settings'
  ) THEN
    CREATE POLICY "Public read of app_settings"
      ON app_settings FOR SELECT TO anon USING (true);
  END IF;

  -- Authenticated full access: the kitchen flips the toggle.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_settings' AND policyname = 'Authenticated manage app_settings'
  ) THEN
    CREATE POLICY "Authenticated manage app_settings"
      ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;
