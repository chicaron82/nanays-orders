-- Migration 011: Ensure anon INSERT policy exists on order_requests
--
-- The public customer form (PublicRequestPage) uses the anon key to submit
-- requests. If the policy from migration 009 was never applied to the live DB
-- (or was dropped), the INSERT fails with a 401 RLS violation.
--
-- This DO block is idempotent: it creates the policy only if it's missing,
-- so it's safe to run even if 009 was previously applied.

DO $$
BEGIN
  -- Anon INSERT (public form submissions)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_requests'
      AND policyname = 'Enable public inserts on order_requests'
  ) THEN
    CREATE POLICY "Enable public inserts on order_requests"
      ON order_requests FOR INSERT
      TO anon
      WITH CHECK (status = 'Pending');
  END IF;

  -- Authenticated full access (dashboard admin)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_requests'
      AND policyname = 'Enable full access for authenticated users on order_requests'
  ) THEN
    CREATE POLICY "Enable full access for authenticated users on order_requests"
      ON order_requests FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Make sure RLS is enabled (no-op if already on)
  -- (Cannot use IF NOT EXISTS here; ALTER TABLE … ENABLE is idempotent anyway)
END
$$;

-- Belt-and-suspenders: ensure RLS is on the table
ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;
