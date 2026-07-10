-- Migration 019: attribute each order to the account that created it.
--
-- Orders had no author — only `source` ('request' | 'manual'). To notify on
-- orders from a specific account (Christine's), we need to know who inserted
-- each row. `auth.uid()` resolves from the caller's JWT, so every future insert
-- self-stamps with no client change. Forward-only: existing rows stay NULL
-- (like `source` in migration 015). Request-link approvals stamp whoever
-- approved (the signed-in kitchen user), which is the intended behaviour.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
