-- Enable Row Level Security on all core tables that were created before
-- RLS was part of the migration workflow. Grants full access to authenticated
-- users only — anonymous/public access is blocked entirely.

ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users have full access" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access" ON stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access" ON expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users have full access" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
