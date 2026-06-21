-- Migration 013: Push notification via ntfy.sh when a new order request arrives.
--
-- Uses pg_net (already enabled) to POST to ntfy.sh's JSON API on every INSERT
-- to order_requests. The topic name is a shared secret — treat it like a password.
-- Nanay subscribes once in the ntfy app; every new request pings her phone.

CREATE OR REPLACE FUNCTION notify_ntfy_on_order_request()
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
      'topic',    'nanays-kitchen-d959ccf0614ed277cb13',
      'title',    'New Order Request' || rush_label,
      'message',  NEW.customer_name
                  || ' • $' || to_char(NEW.total, 'FM9990.00')
                  || ' • ' || to_char(NEW.needed_date, 'Mon DD')
                  || ' • ' || delivery_label,
      'priority', 4,
      'tags',     jsonb_build_array('bell')
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_request_ntfy_notify
  AFTER INSERT ON order_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_ntfy_on_order_request();
