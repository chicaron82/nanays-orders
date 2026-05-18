-- Secure Nanay's Orders: RLS Setup

-- 1. Enable Row Level Security (RLS) on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for 'orders'
-- Allow authenticated users to SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Enable read access for authenticated users only" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users only" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users only" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for authenticated users only" ON orders FOR DELETE TO authenticated USING (true);

-- 3. Create Policies for 'stock'
CREATE POLICY "Enable read access for authenticated users only" ON stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users only" ON stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users only" ON stock FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Create Policies for 'customers'
CREATE POLICY "Enable read access for authenticated users only" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users only" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users only" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
