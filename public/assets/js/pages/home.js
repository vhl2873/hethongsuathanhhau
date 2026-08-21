import { api } from '../lib/api.js';
import { observeReveal } from '../lib/reveal.js';
import { escapeHtml } from '../lib/format.js';
import { initCarousel } from '../lib/carousel.js';
import { renderProductCard, renderCardSkeletons, discountPercent } from '../lib/product-card.js';
import { renderVoucherCard, wireCopyButtons } from '../lib/coupon.js';
import { renderPostCard } from '../lib/post-card.js';

// Icons for the category grid. Matched on the category name so a shop that
// renames or adds categories still gets a sensible glyph; anything
// unrecognised falls back to the milk-tin icon rather than an empty box.
const CATEGORY_ICONS = [
  { match: ['sữa bột', 'công thức'], path: '<path d="M8 8h8v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z"></path><path d="M9 8V5h6v3M8 12h8"></path>' },
  { match: ['sữa tươi', 'tiệt trùng'], path: '<path d="M7 4h10l-1 16.2a1.8 1.8 0 0 1-1.8 1.8H9.8A1.8 1.8 0 0 1 8 20.2L7 4z"></path><path d="M7.4 10h9.2"></path>' },
  { match: ['bầu', 'sau sinh', 'mẹ'], path: '<path d="M12 20.5s-6.5-4.2-6.5-9A4 4 0 0 1 12 8.6a4 4 0 0 1 6.5 2.9c0 4.8-6.5 9-6.5 9z"></path>' },
  { match: ['người lớn', 'gia đình', 'xương'], path: '<path d="M6 20a6 6 0 0 1 12 0z"></path><path d="M9 4h6l-1 5H10L9 4z"></path><path d="M12 9v5"></path>' },
  { match: ['bình sữa', 'núm ti'], path: '<path d="M10 3h4v2.2c0 .6.3 1.1.8 1.5C16 7.6 17 9 17 11v7.5a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.5V11c0-2 1-3.4 2.2-4.3.5-.4.8-.9.8-1.5V3z"></path>' },
  { match: ['máy', 'tiệt trùng', 'hâm'], path: '<rect x="4" y="6" width="16" height="13" rx="2.5"></rect><path d="M9 6V4h6v2M8 12h8"></path>' },
  { match: ['tã', 'bỉm'], path: '<path d="M4 9.5C7 7 17 7 20 9.5v3c0 3-3.6 5.5-8 5.5S4 15.5 4 12.5v-3z"></path><path d="M9 18v2.5M15 18v2.5"></path>' },
  { match: ['ăn dặm', 'bột', 'cháo'], path: '<path d="M5 13h14a7 7 0 0 1-7 7 7 7 0 0 1-7-7z"></path><path d="M9 9.5c0-1.6 1.3-2 1.3-3.2S9 4 9 4M14 9.5c0-1.6 1.3-2 1.3-3.2S14 4 14 4"></path>' },
  { match: ['đồ dùng', 'phụ kiện'], path: '<path d="M6 7h12l-1 12a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 19L6 7z"></path><path d="M9.5 7V5.5A2.5 2.5 0 0 1 12 3a2.5 2.5 0 0 1 2.5 2.5V7"></path>' },
];
const FALLBACK_ICON = CATEGORY_ICONS[0].path;

// Real photo thumbnails for the categories that ship by default. Anything
// the shop renames or adds beyond these still gets the line-icon fallback
// below rather than a broken image.
const CATEGORY_PHOTOS = [
  { match: ['sữa bột', 'công thức'], src: './assets/img/categories/sua-bot.png' },
  { match: ['sữa tươi', 'tiệt trùng'], src: './assets/img/categories/sua-tuoi.png' },
  { match: ['bầu', 'sau sinh', 'mẹ'], src: './assets/img/categories/sua-bau.png' },
  { match: ['đồ dùng', 'phụ kiện'], src: './assets/img/categories/do-dung-cho-be.png' },
];

function iconFor(name) {
  const lower = (name || '').toLowerCase();
  const found = CATEGORY_ICONS.find((icon) => icon.match.some((keyword) => lower.includes(keyword)));
  return found ? found.path : FALLBACK_ICON;
}

function photoFor(name) {
  const lower = (name || '').toLowerCase();
  const found = CATEGORY_PHOTOS.find((photo) => photo.match.some((keyword) => lower.includes(keyword)));
  return found?.src || null;
}

function categoryIcon(name) {
  const photo = photoFor(name);
  const inner = photo
    ? `<img src="${escapeHtml(photo)}" alt="" width="56" height="56" loading="lazy" />`
    : `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${iconFor(name)}</svg>`;
  return `<span class="cat-grid__icon" aria-hidden="true">${inner}</span>`;
}

function shopHref(slug) {
  return `./shop.html?category=${encodeURIComponent(slug)}`;
}

// ---------------------------------------------------------------- categories
// The rail, the icon grid and the two tiles beside the hero are three views
// of one /api/categories response.
async function renderCategories() {
  const railEl = document.querySelector('[data-category-rail]');
  const gridEl = document.querySelector('[data-category-grid]');
  const tilesEl = document.querySelector('[data-category-tiles]');

  let categories = [];
  try {
    categories = await api.get('/api/categories');
  } catch {
    if (railEl) railEl.innerHTML = '<li class="empty-state">Không tải được danh mục.</li>';
    if (gridEl) gridEl.innerHTML = '<p class="empty-state">Không tải được danh mục.</p>';
    if (tilesEl) tilesEl.innerHTML = '';
    return;
  }

  if (!categories.length) {
    if (railEl) railEl.innerHTML = '<li class="empty-state">Chưa có danh mục.</li>';
    if (gridEl) gridEl.innerHTML = '<p class="empty-state">Chưa có danh mục nào.</p>';
    if (tilesEl) tilesEl.innerHTML = '';
    return;
  }

  if (railEl) {
    railEl.innerHTML = categories
      .slice(0, 9)
      .map(
        (category) => `
        <li>
          <a class="home-rail__link" href="${shopHref(category.slug)}">
            <span class="home-rail__dot" aria-hidden="true"></span>
            <span class="home-rail__name">${escapeHtml(category.name)}</span>
            <span class="home-rail__chevron" aria-hidden="true">&rsaquo;</span>
          </a>
        </li>`,
      )
      .join('');
  }

  if (gridEl) {
    const flat = categories.flatMap((category) => [category, ...(category.children || [])]);
    gridEl.innerHTML = flat
      .slice(0, 8)
      .map(
        (category) => `
        <a class="cat-grid__item" href="${shopHref(category.slug)}">
          ${categoryIcon(category.name)}
          <span class="cat-grid__name">${escapeHtml(category.name)}</span>
        </a>`,
      )
      .join('');
  }

  if (tilesEl) renderCategoryTiles(tilesEl, categories.slice(0, 2));
}

// Each tile shows a real category and borrows the artwork from one product
// inside it, so the tile can never advertise a promotion that doesn't exist.
async function renderCategoryTiles(container, categories) {
  if (!categories.length) {
    container.innerHTML = '';
    return;
  }

  const tiles = await Promise.all(
    categories.map(async (category) => {
      let product = null;
      try {
        const products = await api.get(`/api/products?category=${encodeURIComponent(category.slug)}&limit=1`);
        product = products[0] || null;
      } catch {
        product = null;
      }

      const art = product?.image_url
        ? `<img src="${escapeHtml(product.image_url)}" alt="" width="104" height="104" loading="lazy" />`
        : '';

      return `
        <a class="home-tile" href="${shopHref(category.slug)}">
          <span>
            <span class="home-tile__eyebrow">Danh mục</span>
            <span class="home-tile__title">${escapeHtml(category.name)}</span>
          </span>
          <span class="home-tile__more">Xem sản phẩm &rarr;</span>
          ${art}
        </a>`;
    }),
  );

  container.innerHTML = tiles.join('');
}

// ------------------------------------------------------------------ coupons
async function renderCoupons() {
  const section = document.querySelector('[data-voucher-section]');
  const grid = document.querySelector('[data-voucher-grid]');
  if (!section || !grid) return;

  try {
    const coupons = await api.get('/api/coupons?limit=4');
    if (!coupons.length) return;
    grid.innerHTML = coupons.map(renderVoucherCard).join('');
    wireCopyButtons(grid);
    section.hidden = false;
  } catch {
    // No usable codes (or an older API build without the endpoint): the
    // block stays hidden instead of showing a broken promotion.
  }
}

// -------------------------------------------------------------------- deals
// /api/products has no "on sale" filter, so this reads one page and keeps
// the rows whose price really is below their compare-at price.
async function renderDeals() {
  const section = document.querySelector('[data-deals-section]');
  const grid = document.querySelector('[data-deals-grid]');
  if (!section || !grid) return;

  try {
    const products = await api.get('/api/products?limit=48');
    const discounted = products
      .filter((product) => discountPercent(product) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 5);

    if (!discounted.length) return;
    grid.innerHTML = discounted.map(renderProductCard).join('');
    section.hidden = false;
  } catch {
    // Leave hidden.
  }
}

// ----------------------------------------------------------------- featured
const featuredGrid = document.querySelector('[data-featured-grid]');
const featuredTabs = document.querySelector('[data-featured-tabs]');

async function loadFeatured(query) {
  if (!featuredGrid) return;
  featuredGrid.innerHTML = renderCardSkeletons(5);

  try {
    const products = await api.get(`/api/products?${query}&limit=10`);
    if (!products.length) {
      featuredGrid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Chưa có sản phẩm nào ở mục này</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    featuredGrid.innerHTML = products.map(renderProductCard).join('');
  } catch {
    featuredGrid.innerHTML = `
      <div class="empty-state product-grid__empty">
        <p class="empty-state__title">Không tải được sản phẩm</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

function wireFeaturedTabs() {
  if (!featuredTabs) return;
  featuredTabs.querySelectorAll('[data-tab-query]').forEach((btn) => {
    btn.addEventListener('click', () => {
      featuredTabs.querySelectorAll('[data-tab-query]').forEach((other) => other.classList.remove('is-active'));
      btn.classList.add('is-active');
      loadFeatured(btn.dataset.tabQuery);
    });
  });
}

// --------------------------------------------------------------------- blog
async function renderHomeBlogPosts() {
  const grid = document.querySelector('[data-home-blog-grid]');
  if (!grid) return;

  try {
    const posts = await api.get('/api/posts?limit=3');
    if (!posts.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có bài viết nào</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    grid.innerHTML = posts.map(renderPostCard).join('');
  } catch {
    grid.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được bài viết</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

renderCategories();
renderCoupons();
renderDeals();
loadFeatured('featured=true');
wireFeaturedTabs();
renderHomeBlogPosts();
observeReveal();

const carouselRoot = document.querySelector('[data-carousel]');
if (carouselRoot) initCarousel(carouselRoot);
