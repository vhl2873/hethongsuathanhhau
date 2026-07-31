// Plain (non-module) script loaded first in every page's <head>, before any
// <script type="module">. This is the one file that differs per deploy
// target (local/dev/prod) - edit the values below when deploying, no build
// step required. Supabase anon key is safe to ship here (it's RLS-scoped).
window.__APP_CONFIG__ = {
  API_BASE_URL: 'http://localhost:3001',
  SUPABASE_URL: 'https://mvvhdyaawrtdbyjiobau.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_zbQG8Ce_Q5pI4Lp8xlH9iQ_7SezclTy',
};
