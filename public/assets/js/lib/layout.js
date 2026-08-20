import { api } from './api.js';
import * as cart from '../cart.js';
import { escapeHtml, formatCurrency } from './format.js';
import { getSession, onAuthStateChange } from '../auth.js';

// Called by include.js right after header/footer partials are injected into
// the DOM - populates the parts that need real data (per-category nav
// items, category search filter, search quick-links, footer store info,
// payment methods, cart badge/total, account link) instead of hardcoding
// them into the partial HTML.
export async function initLayout() {
  await Promise.all([renderCategoryData(), renderStoreSettings(), renderPaymentMethods(), refreshAccountLink()]);
  refreshCartIndicators();
  markCurrentPage();
  window.addEventListener('cart:changed', refreshCartIndicators);
  wireMobileMenuToggle();
  wireNavDropdowns();
  wireNewsletterForm();
  onAuthStateChange(() => refreshAccountLink());
}

// One /api/categories fetch feeds the flat per-category nav items (each
// with its own dropdown for children, if any), the category filter in the
// header search bar, the search quick-links, and the footer category list.
async function renderCategoryData() {
  const navAnchor = document.querySelector('[data-category-nav-anchor]');
  const select = document.querySelector('[data-category-select]');
  const suggestionsEl = document.querySelector('[data-search-suggestions]');
  const footerListEl = document.querySelector('[data-footer-categories]');

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

    // Quick-links under the search field: the store's own top categories,
    // not invented "popular searches" nobody has actually searched for.
    if (suggestionsEl) {
      suggestionsEl.innerHTML = categories
        .slice(0, 4)
        .map(
          (category) =>
            `<a class="site-header__suggestion" href="./shop.html?category=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a>`,
        )
        .join('');
    }

    if (footerListEl && categories.length) {
      footerListEl.innerHTML = categories
        .slice(0, 5)
        .map(
          (category) =>
            `<li><a href="./shop.html?category=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`,
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
// wherever they appear (header utility bar, header hotline, footer,
// floating dock) - all three share the same one fetch instead of each
// querying /api/settings separately.
async function renderStoreSettings() {
  try {
    const settings = await api.get('/api/settings');
    setText('[data-store-name]', settings.store_name);
    setText('[data-store-address]', settings.store_address);
    setText('[data-store-hours]', settings.opening_hours);
    setText('[data-store-email]', settings.store_email);
    setText('[data-store-hotline]', settings.store_hotline);

    if (settings.store_hotline) {
      const tel = `tel:${String(settings.store_hotline).replace(/\s+/g, '')}`;
      document.querySelectorAll('[data-store-hotline-link]').forEach((el) => {
        el.href = tel;
        el.hidden = false;
      });
    }

    document.querySelectorAll('[data-store-email-link]').forEach((el) => {
      if (!settings.store_email) return;
      el.href = `mailto:${settings.store_email}`;
    });

    // The Zalo pill in the floating dock only appears once a Zalo link has
    // actually been configured in admin settings - a dead "Chat Zalo"
    // button is worse than no button.
    const zaloUrl = settings.social_links?.zalo;
    if (zaloUrl) {
      document.querySelectorAll('[data-store-zalo-link]').forEach((el) => {
        el.href = zaloUrl;
        el.target = '_blank';
        el.rel = 'noopener';
        el.hidden = false;
      });
    }
  } catch {
    // Honest empty state: leave the static fallback text already written in
    // the partials rather than showing an error banner.
  }

  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

// Footer "Thanh toán" chips list what the store really accepts, read from
// the same payment_methods table checkout uses.
async function renderPaymentMethods() {
  const container = document.querySelector('[data-footer-payments]');
  if (!container) return;

  try {
    const methods = await api.get('/api/checkout/payment-methods');
    if (!methods.length) return;
    container.innerHTML = methods.map((method) => `<span>${escapeHtml(method.name)}</span>`).join('');
    container.hidden = false;
  } catch {
    // Leave the block hidden.
  }
}

function setText(selector, value) {
  if (!value) return;
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
}

// Header cart pill shows count + running total; the mobile tab bar shows
// the same count, so both are updated from one place.
function refreshCartIndicators() {
  const count = cart.getCount();
  document.querySelectorAll('[data-cart-count]').forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  });
  document.querySelectorAll('[data-cart-total]').forEach((el) => {
    el.textContent = formatCurrency(cart.getTotal());
  });
}

async function refreshAccountLink() {
  const link = document.querySelector('[data-account-link]');
  if (!link) return;

  const label = link.querySelector('[data-account-label]');
  const session = await getSession();
  if (session) {
    link.href = './account.html';
    link.setAttribute('aria-label', 'Tài khoản của tôi');
    link.classList.add('is-logged-in');
    if (label) {
      const name = session.user?.user_metadata?.full_name || session.user?.email || 'Tài khoản';
      label.textContent = name;
    }
  } else {
    link.href = './login.html';
    link.setAttribute('aria-label', 'Đăng nhập');
    link.classList.remove('is-logged-in');
    if (label) label.textContent = 'Đăng nhập';
  }
}

// Highlights the current page in the category strip and the mobile tab bar
// so the user can see where they are without reading the URL.
function markCurrentPage() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  const page = file.replace('.html', '') || 'index';

  document.querySelectorAll('.mobile-tabbar__link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.tab === page);
  });

  const activeCategory = new URLSearchParams(window.location.search).get('category');
  document.querySelectorAll('.main-nav__item > .main-nav__link[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isCurrent = activeCategory
      ? href.includes(`category=${encodeURIComponent(activeCategory)}`)
      : href === `./${file}` && !href.includes('category=');
    if (isCurrent) link.closest('.main-nav__item').classList.add('is-active');
  });
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

// Footer newsletter: posts to the same /api/newsletter endpoint the
// contact page uses, and reports the real outcome instead of always
// claiming success.
function wireNewsletterForm() {
  const form = document.querySelector('[data-newsletter-form]');
  if (!form) return;
  const messageEl = document.querySelector('[data-newsletter-message]');
  const input = form.querySelector('input[name="email"]');
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!messageEl) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      messageEl.textContent = 'Vui lòng nhập email hợp lệ.';
      messageEl.classList.add('is-error');
      return;
    }

    submit.disabled = true;
    messageEl.classList.remove('is-error');
    messageEl.textContent = 'Đang gửi…';

    try {
      await api.post('/api/newsletter', { email });
      form.reset();
      messageEl.textContent = 'Đã đăng ký nhận thông báo ưu đãi.';
    } catch {
      messageEl.textContent = 'Không gửi được, vui lòng thử lại sau.';
      messageEl.classList.add('is-error');
    } finally {
      submit.disabled = false;
    }
  });
}

// Click-to-toggle for dropdown nav items (category items with children,
// "Cẩm nang") - works on both desktop (mouse) and mobile (touch), unlike
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
      // like "Cẩm nang" that have no navigation target of their own.
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
