-- Supabase Setup Script for Nanay's Orders

-- 1. Create orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  contact TEXT,
  lumpia JSONB DEFAULT '{"enabled": false, "style": "uncooked", "sets": 1}'::jsonb,
  pancit JSONB DEFAULT '{"enabled": false, "full": 1, "half": 0}'::jsonb,
  needed_date DATE NOT NULL,
  pickup_time TEXT,
  delivery_type TEXT DEFAULT 'pickup',
  address TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  deposit_amount NUMERIC DEFAULT 0,
  notes TEXT,
  preferences TEXT,
  order_status TEXT DEFAULT 'Pending',
  total NUMERIC
);

-- 2. Create stock table (single row singleton)
CREATE TABLE stock (
  id INTEGER PRIMARY KEY DEFAULT 1,
  lumpia_sets INTEGER DEFAULT 0,
  wrapper_packs INTEGER DEFAULT 0,
  pancit_full INTEGER DEFAULT 0,
  pancit_half INTEGER DEFAULT 0
);

-- Insert the single stock tracking row
INSERT INTO stock (id, lumpia_sets, wrapper_packs, pancit_full, pancit_half) 
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Create customers table (for saved preferences)
CREATE TABLE customers (
  name TEXT PRIMARY KEY,
  contact TEXT,
  preferences TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Disable RLS for rapid prototyping (WARNING: Enable and configure policies before going to production!)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
