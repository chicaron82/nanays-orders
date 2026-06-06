-- Blocked days: dates the family is unavailable for orders.
-- Used to warn when an order is booked on a blocked day and redirect
-- to the next available date.

CREATE TABLE IF NOT EXISTS blocked_days (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       date        NOT NULL UNIQUE,
  reason     text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE blocked_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read blocked days"
  ON blocked_days FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage blocked days"
  ON blocked_days FOR ALL
  USING (auth.role() = 'authenticated');
