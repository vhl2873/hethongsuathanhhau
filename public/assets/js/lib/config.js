// Reads values set by assets/js/env.js (must be loaded as a plain <script>
// before any module script in the page's <head>).
const config = window.__APP_CONFIG__ || {};

export const API_BASE_URL = config.API_BASE_URL || 'http://localhost:3000';
export const SUPABASE_URL = config.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
