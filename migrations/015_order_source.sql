-- Migration 015: order source attribution
--
-- Track where an order originated so Insights can measure the public request
-- link (the marketplace funnel). 'request' = created by approving a public form
-- submission; 'manual' = entered by the kitchen. Existing + future manual orders
-- default to 'manual'; the approve-request path stamps 'request'.
--
-- Forward-only: a past order can't be retroactively attributed (the request is
-- deleted on approval), so the metric accumulates from here.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
