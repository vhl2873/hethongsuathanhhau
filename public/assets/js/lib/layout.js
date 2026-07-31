import { api } from './api.js';
import * as cart from '../cart.js';
import { escapeHtml } from './format.js';
import { getSession, onAuthStateChange } from '../auth.js';

// Called by include.js right after header/footer partials are injected into
// the DOM - populates the parts that need real data (per-category nav
// items, category search filter, footer store info, cart badge, account
// icon) instead of hardcoding them into the partial HTML.
export async function initLayout() {
  await Promise.all([renderCategoryData(), renderStoreSettings(), refreshAccountLink()]);
  refreshCartBadge();
  window.addEventListener('cart:changed', refreshCartBadge);
  wireMobileMenuToggle();
  wireNavDropdowns();
  onAuthStateChange(() => refreshAccountLink());
}

// One /api/categories fetch feeds both the flat per-category nav items
// (each with its own dropdown for children, if any) and the category
// filter in the header search bar.
async function renderCategoryData() {
  const navAnchor = document.querySelector('[data-category-nav-anchor]');
  const select = document.querySelector('[data-category-select]');
  if (!navAnchor && !select) return;

  try {
    const categories = await api.get('/api/categories');

    if (navAnchor) {
      navAnchor.outerHTML = categories.length
        ? categories.map(renderCategoryNavItem).join('')
        : '<li class="main-nav__item"><span class="main-nav__link main-nav__link--muted">Chưa có danh mục</span></li>';
      wireNavDropdowns();
    }

    if (select) {
      const activeSlug = new URLSearchParams(window.location.search).get('category') || '';
      const flat = flattenCategories(categories);
      select.innerHTML =
        '<option value="">Tất cả danh mục</option>' +
        flat
          .map(
            (category) =>
              `<option value="${escapeHtml(category.slug)}" ${category.slug === activeSlug ? 'selected' : ''}>${'  '.repeat(category.depth)}${escapeHtml(category.name)}</option>`,
          )
          .join('');
    }
  } catch {
    if (navAnchor) {
      navAnchor.outerHTML =
        '<li class="main-nav__item"><span class="main-nav__link main-nav__link--muted">Không tải được danh mục</span></li>';
    }
  }
}

function flattenCategories(categories, depth = 0) {
  return categories.flatMap((category) => [
    { slug: category.slug, name: category.name, depth },
    ...flattenCategories(category.children || [], depth + 1),
  ]);
}

// Each top-level category is its own nav item linking straight to that
// category's shop page. Only categories that actually have sub-categories
// get a dropdown (hover-revealed) - no dropdown is shown for a category
// with nothing real to put in it.
function renderCategoryNavItem(category) {
  const hasChildren = category.children?.length > 0;
  const href = `./shop.html?category=${encodeURIComponent(category.slug)}`;

  if (!hasChildren) {
    return `<li class="main-nav__item"><a class="main-nav__link" href="${href}">${escapeHtml(category.name)}</a></li>`;
  }

  const childItems = category.children
    .map((child) => `<li><a href="./shop.html?category=${encodeURIComponent(child.slug)}">${escapeHtml(child.name)}</a></li>`)
    .join('');

  return `<li class="main-nav__item main-nav__item--dropdown">
    <a class="main-nav__link" href="${href}">
      ${escapeHtml(category.name)}
      <svg class="main-nav__caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>
    <ul class="main-nav__dropdown">${childItems}</ul>
  </li>`;
}

// Populates every occurrence of the shared data-store-* attributes,
// wherever they appear (header utility bar, footer) - both partials share
// the same one fetch instead of each querying /api/settings separately.
async function renderStoreSettings() {
  try {
    const settings = await api.get('/api/settings');
    setText('[data-store-name]', settings.store_name);
    setText('[data-store-address]', settings.store_address);
    setText('[data-store-hours]', settings.opening_hours);
    setText('[data-store-email]', settings.store_email);

    document.querySelectorAll('[data-store-hotline]').forEach((el) => {
      if (!settings.store_hotline) return;
      el.textContent = settings.store_hotline;
      el.href = `tel:${settings.store_hotline.replace(/\s+/g, '')}`;
    });

    document.querySelectorAll('[data-store-email-link]').forEach((el) => {
      if (!settings.store_email) return;
      el.href = `mailto:${settings.store_email}`;
    });
  } catch {
    // Honest empty state: leave the static fallback text already written in
    // the partials rather than showing an error banner.
  }

  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

function setText(selector, value) {
  if (!value) return;
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
}

function refreshCartBadge() {
  const badge = document.querySelector('[data-cart-count]');
  if (!badge) return;
  const count = cart.getCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

async function refreshAccountLink() {
  const link = document.querySelector('[data-account-link]');
  if (!link) return;

  const session = await getSession();
  if (session) {
    link.href = './account.html';
    link.setAttribute('aria-label', 'Tài khoản của tôi');
    link.classList.add('is-logged-in');
  } else {
    link.href = './login.html';
    link.setAttribute('aria-label', 'Đăng nhập');
    link.classList.remove('is-logged-in');
  }
}

function wireMobileMenuToggle() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('.site-header__nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// Click-to-toggle for dropdown nav items (category items with children,
// "Góc tư vấn") - works on both desktop (mouse) and mobile (touch), unlike
// a CSS-only :hover menu. Re-run after category items are injected since
// those are new DOM nodes without listeners yet; addEventListener on the
// same node twice is harmless (duplicate handlers) so guard with a marker.
function wireNavDropdowns() {
  const items = document.querySelectorAll('.main-nav__item--dropdown');
  if (!items.length) return;

  items.forEach((item) => {
    if (item.dataset.dropdownWired) return;
    item.dataset.dropdownWired = 'true';

    const trigger = item.querySelector('.main-nav__link');
    trigger?.addEventListener('click', (event) => {
      // Category items are real links (navigate on click); only prevent
      // the default/close-on-outside-click dance for button-only triggers
      // like "Góc tư vấn" that have no navigation target of their own.
      if (trigger.tagName === 'BUTTON') {
        event.preventDefault();
      } else {
        return; // let the <a> navigate normally; hover already reveals the dropdown
      }
      event.stopPropagation();
      const isOpen = item.classList.contains('is-open');
      document.querySelectorAll('.main-nav__item--dropdown.is-open').forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.main-nav__link')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  if (!document.body.dataset.navOutsideClickWired) {
    document.body.dataset.navOutsideClickWired = 'true';
    document.addEventListener('click', () => {
      document.querySelectorAll('.main-nav__item--dropdown.is-open').forEach((item) => {
        item.classList.remove('is-open');
        item.querySelector('.main-nav__link')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
}
