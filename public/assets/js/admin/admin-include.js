import { signOut } from '../auth.js';

// Mirrors assets/js/lib/include.js's partial-injection approach, but for
// the admin shell (topbar + sidebar nav) instead of the storefront
// header/footer - the two have different enough markup/behavior (logout
// button, active-nav highlighting) to not share one partial.
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

function highlightActiveNav() {
  const page = document.body.dataset.adminPage;
  if (!page) return;
  document.querySelector(`[data-nav="${page}"]`)?.classList.add('is-active');
}

async function includeAdminShell() {
  await loadPartial('#admin-shell', './partials/admin-nav.html');
  highlightActiveNav();
  document.querySelector('[data-admin-logout]')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = './login.html';
  });
}

includeAdminShell();
