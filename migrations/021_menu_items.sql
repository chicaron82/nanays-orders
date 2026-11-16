-- Migration 021: menu_items — the dishes sis adds, edits and prices herself
--
-- Aaron, 2026-11-16: "a new menu item. leche flan for $13" and "what if we turned it into a general add menu item
-- instead this way she can add and edit items on her own without going through us". Ticket:
-- docs/ticket-orders-menu-items.md.
--
-- • Lumpia and pancit stay in the code (lib/utils): they carry stock math, cooked/uncooked and sauces. This table is
--   for everything else.
-- • An order never points at this table for its price. Adding an item to an order COPIES { name, price, qty,
--   menu_item_id } into orders.custom_items (migration 006), so a re-price never rewrites a past order's total.
-- • Two switches: `active` (on the menu at all, both forms) and `on_request_page` (Aaron: "a check box if she wants it
--   to appear on the customer request page"). A new item starts kitchen-only. There is no delete in the app: taking
--   an item off the menu is the delete.
-- • anon may SELECT, and only rows that are active AND on the request page. The table holds no customer details, so
--   the public page reading it is the same exposure as the printed menu.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS menu_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text          NOT NULL CHECK (length(btrim(name)) > 0),
  price           numeric(10,2) NOT NULL CHECK (price > 0),
  photo_path      text,
  active          boolean       NOT NULL DEFAULT true,
  on_request_page boolean       NOT NULL DEFAULT false,
  sort            int           NOT NULL DEFAULT 0,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_items' AND policyname = 'Public read of the request-page menu') THEN
    CREATE POLICY "Public read of the request-page menu"
      ON menu_items FOR SELECT TO anon USING (active AND on_request_page);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_items' AND policyname = 'Authenticated manage menu_items') THEN
    CREATE POLICY "Authenticated manage menu_items"
      ON menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Supabase stopped auto-granting new public tables on 2026-10-30 (CLAUDE.md). As narrow as the RLS already is.
-- The REVOKE first: this project's default privileges still handed anon EVERYTHING on create (applied 2026-11-16,
-- seen in role_table_grants), TRUNCATE included, which RLS does not cover. Start from nothing, grant what's used.
REVOKE ALL ON public.menu_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT SELECT ON public.menu_items TO anon;
GRANT ALL ON public.menu_items TO service_role;

-- The first item: one leche flan (a llanera), $13, on the customer page from day one (Aaron's answer, 2026-11-16).
INSERT INTO menu_items (name, price, on_request_page, sort)
SELECT 'Leche Flan', 13, true, 0
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE lower(name) = 'leche flan');
