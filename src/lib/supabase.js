import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw an error early if missing to prevent silent failures
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.");
}

export const supabase = createClient(
  supabaseUrl || 'https://pxflifrmipunlzzgpjnq.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4ZmxpZnJtaXB1bmx6emdwam5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDkzOTksImV4cCI6MjA5NDYyNTM5OX0.po_Txb0iVk6Oilf871BETdAeVAjb0s8XUBfbvLDLVsk'
);
