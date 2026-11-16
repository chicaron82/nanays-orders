-- Migration 022: menu-photos — where sis's menu-item photos live
--
-- Aaron, 2026-11-16: "a way for sis to upload a photo to use for the the menu item". Ticket:
-- docs/ticket-orders-menu-items.md (commit 2).
--
-- • A PUBLIC bucket: the customer page shows these photos to anyone, the same as the lumpia and pancit shots in
--   public/menu/. Public read needs no SELECT policy; the object URL is served as is.
-- • Only a signed-in kitchen account may add, replace or remove one, and only in this bucket.
-- • The app shrinks every photo on the phone first (lib/photo) to WebP, or JPEG where the browser can't encode WebP
--   (Safari). The bucket refuses anything else, and anything over 5 MB, so a raw phone photo can't land by mistake.
--
-- Idempotent: safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-photos', 'menu-photos', true, 5242880, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Kitchen adds menu photos') THEN
    CREATE POLICY "Kitchen adds menu photos" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Kitchen replaces menu photos') THEN
    CREATE POLICY "Kitchen replaces menu photos" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'menu-photos') WITH CHECK (bucket_id = 'menu-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Kitchen removes menu photos') THEN
    CREATE POLICY "Kitchen removes menu photos" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'menu-photos');
  END IF;
  -- remove() looks the object up before deleting it, so the kitchen needs to SELECT its own bucket's rows too.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Kitchen lists menu photos') THEN
    CREATE POLICY "Kitchen lists menu photos" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'menu-photos');
  END IF;
END
$$;
