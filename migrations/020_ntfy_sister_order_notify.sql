-- Migration 020: push Aaron when his sister Christine adds an order.
--
-- Mirrors migration 013 (request-link ntfy) but fires AFTER INSERT ON orders,
-- filtered to Christine's account, on a SEPARATE ntfy topic so Aaron can tell a
-- sister-order ping from a request-link ping at a glance. Requires migration 019
-- (orders.created_by). The topic is a shared secret — treat it like a password.
--
-- Christine's uid: bf5238ff-3426-4862-bda1-d4037d9e5d5b (csauddin21@gmail.com).
-- Non-Christine inserts have created_by <> her uid (or NULL) so the WHEN clause
-- keeps the trigger from firing on Aaron's / Nanay's / request-link orders.

CREATE OR REPLACE FUNCTION notify_ntfy_on_sister_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  delivery_label text;
  rush_label     text;
BEGIN
  delivery_label := CASE
    WHEN NEW.delivery_type = 'delivery' THEN 'Delivery'
    ELSE 'Pickup'
  END;

  rush_label := CASE WHEN NEW.rush_order THEN ' ⚡ RUSH' ELSE '' END;

  PERFORM net.http_post(
    url     := 'https://ntfy.sh/',
    body    := jsonb_build_object(
      'topic',    'nanays-sister-0ed68b81ee30af448333',
      'title',    'New order from Christine' || rush_label,
      'message',  NEW.customer_name
                  || ' • $' || to_char(NEW.total, 'FM9990.00')
                  || ' • ' || to_char(NEW.needed_date, 'Mon DD')
                  || ' • ' || delivery_label,
      'priority', 4,
      'tags',     jsonb_build_array('woman')  -- distinct from the request 'bell'
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER sister_order_ntfy_notify
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.created_by = 'bf5238ff-3426-4862-bda1-d4037d9e5d5b')
  EXECUTE FUNCTION notify_ntfy_on_sister_order();
