import { initLayout } from './layout.js';

// Solves the header/footer duplication problem: every page has empty
// <div id="site-header">/<div id="site-footer"> placeholders; this fetches
// the two shared partials once and injects them, instead of copy-pasting
// nav/footer markup into every .html file. Requires the site to be served
// over http(s) (a static server, not double-clicked file:// - browsers
// block fetch() of local files under file:// by default).
async function loadPartial(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    el.innerHTML = await res.text();
  } catch {
    el.innerHTML = '';
  }
}

async function includePartials() {
  await Promise.all([
    loadPartial('#site-header', './partials/header.html'),
    loadPartial('#site-footer', './partials/footer.html'),
  ]);
  await initLayout();
}

includePartials();
