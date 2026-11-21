-- Migration 023: live updates — the tables the app listens to join Supabase's realtime publication
--
-- Aaron, 2026-11-21: "it should update. that way it won't accidentally produce duplicate orders". Ticket:
-- docs/ticket-realtime-on.md.
--
-- Every hook (useOrders, useOrderRequests, useMenuItems, useBlockedDays, useExpenses) subscribes to postgres_changes on
-- its table, but `supabase_realtime` published no tables, so they heard nothing and a screen only caught up on reload.
-- Realtime still respects RLS: a client only receives rows it could select.
--
-- Idempotent: each table is added only if it isn't already published.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'order_requests', 'menu_items', 'blocked_days', 'expenses'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
