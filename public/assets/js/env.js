// Plain (non-module) script loaded first in every page's <head>, before any
// <script type="module">. This is the one file that differs per deploy
// target (local/dev/prod) - edit the values below when deploying, no build
// step required. Supabase anon key is safe to ship here (it's RLS-scoped).
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.__APP_CONFIG__ = {
  API_BASE_URL: isLocalDevelopment ? 'http://localhost:3000' : 'https://hethongsuathanhhau.onrender.com',
  SUPABASE_URL: 'https://fpgjjonlakaruseilisp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_p5og5iOHo59toGdmClszOg_zYvV2Fzz',
};
