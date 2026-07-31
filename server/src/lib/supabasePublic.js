import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong biến môi trường.');
}

// Anon-key client: subject to RLS. Used server-side for two things only -
// verifying a caller's JWT (auth.getUser) and any read that should honor
// the same public policies a browser would get.
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
