-- Migration: Create order_requests table and adjust RLS policies for public ordering.

-- 1. Create the order_requests table
CREATE TABLE IF NOT EXISTS order_requests (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),
  customer_name text        NOT NULL,
  contact       text        NOT NULL,
  lumpia        jsonb       DEFAULT '{"enabled": false, "sets": 0, "setsCooked": true, "halves": 0, "halvesCooked": true, "sauces": []}'::jsonb,
  pancit        jsonb       DEFAULT '{"enabled": false, "full": 0, "half": 0, "large": 0, "extraMeat": false}'::jsonb,
  custom_items  jsonb       DEFAULT '[]'::jsonb,
  needed_date   date        NOT NULL,
  pickup_time   text        NOT NULL,
  delivery_type text        DEFAULT 'pickup',
  address       text,
  notes         text,
  rush_order    boolean     NOT NULL DEFAULT false,
  total         numeric     NOT NULL,
  status        text        DEFAULT 'Pending'
);

-- 2. Enable Row Level Security (RLS) on order_requests
ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for order_requests
-- Allow public (anonymous) users to INSERT requests (write-only)
CREATE POLICY "Enable public inserts on order_requests"
  ON order_requests FOR INSERT
  TO anon
  WITH CHECK (status = 'Pending');

-- Allow authenticated users (dashboard admins) full control
CREATE POLICY "Enable full access for authenticated users on order_requests"
  ON order_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Create RLS Policy for blocked_days
-- Allow public (anonymous) users to read blocked days
CREATE POLICY "Enable public read access for blocked_days"
  ON blocked_days FOR SELECT
  TO anon
  USING (true);
