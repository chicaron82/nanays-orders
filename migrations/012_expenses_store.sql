-- Add store tag to expense entries (trip-level: Superstore, Dollarama, Lucky, or custom text).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS store text;
