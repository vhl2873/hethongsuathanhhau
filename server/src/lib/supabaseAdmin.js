import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL } = process.env;
const SUPABASE_ADMIN_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) {
  throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong biến môi trường.');
}

// Service-role client: bypasses RLS entirely. Only import this from code
// paths that already sit behind requireAuth/requireAdmin - never expose
// this key or this client to the browser.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
