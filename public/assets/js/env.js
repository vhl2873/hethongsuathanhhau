// Plain (non-module) script loaded first in every page's <head>, before any
// <script type="module">. This is the one file that differs per deploy
// target (local/dev/prod) - edit the values below when deploying, no build
// step required. Supabase anon key is safe to ship here (it's RLS-scoped).
window.__APP_CONFIG__ = {
  API_BASE_URL: 'https://sua-du4c.onrender.com',
  SUPABASE_URL: 'https://fpgjjonlakaruseilisp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_p5og5iOHo59toGdmClszOg_zYvV2Fzz',
};
