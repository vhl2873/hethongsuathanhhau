import { api } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

const grid = document.querySelector('[data-product-grid]');
const paginationEl = document.querySelector('[data-pagination]');
const countEl = document.querySelector('[data-result-count]');
const sortSelect = document.querySelector('[data-sort-select]');
const categoryFilterEl = document.querySelector('[data-category-filter]');

function getParams() {
  return new URLSearchParams(window.location.search);
}

function setParam(key, value) {
  const params = getParams();
  if (value) params.set(key, value);
  else params.delete(key);
  if (key !== 'page') params.delete('page');
  window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
}

async function renderCategoryFilters() {
  try {
    const categories = await api.get('/api/categories');
    const activeSlug = getParams().get('category');

    const items = [
      `<li><a class="shop-filters__link${!activeSlug ? ' is-active' : ''}" href="./shop.html">Tất cả sản phẩm</a></li>`,
    ];
    for (const category of categories) {
      const isActive = activeSlug === category.slug;
      items.push(
        `<li><a class="shop-filters__link${isActive ? ' is-active' : ''}" href="./shop.html?category=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a></li>`,
      );
    }
    categoryFilterEl.innerHTML = items.join('');
  } catch {
    categoryFilterEl.innerHTML = '<li class="shop-filters__empty">Không tải được danh mục.</li>';
  }
}

function renderSkeleton() {
  grid.innerHTML = Array.from({ length: 6 })
    .map(() => '<div class="skeleton product-card-skeleton"></div>')
    .join('');
  countEl.textContent = 'Đang tải sản phẩm...';
  paginationEl.innerHTML = '';
}

function renderProductCard(product) {
  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" width="300" height="300" loading="lazy" />`
    : `<div class="product-card__no-image">Chưa có ảnh</div>`;

  const compareAt =
    product.compare_at_price && product.compare_at_price > product.base_price
      ? `<span class="product-card__price-compare">${formatCurrency(product.compare_at_price)}</span>`
      : '';

  return `
    <a class="card product-card" href="./product-details.html?slug=${encodeURIComponent(product.slug)}">
      <div class="product-card__image">${image}</div>
      <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
      <div class="product-card__price">
        <span class="product-card__price-current">${formatCurrency(product.base_price)}</span>
        ${compareAt}
      </div>
    </a>`;
}

function renderPagination(pagination) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  const buttons = [];
  for (let p = 1; p <= totalPages; p += 1) {
    buttons.push(
      `<button type="button" class="pagination__page${p === page ? ' is-active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`,
    );
  }
  paginationEl.innerHTML = buttons.join('');

  paginationEl.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setParam('page', btn.dataset.page);
      loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function loadProducts() {
  renderSkeleton();
  const params = getParams();
  sortSelect.value = params.get('sort') || 'newest';

  const query = new URLSearchParams();
  if (params.get('category')) query.set('category', params.get('category'));
  if (params.get('search')) query.set('search', params.get('search'));
  query.set('sort', params.get('sort') || 'newest');
  query.set('page', params.get('page') || '1');

  try {
    const { data: products, pagination } = await api.get(`/api/products?${query.toString()}`, { raw: true });

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Không tìm thấy sản phẩm phù hợp</p>
          <p>Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác.</p>
        </div>`;
      countEl.textContent = 'Không có sản phẩm nào.';
      paginationEl.innerHTML = '';
      return;
    }

    grid.innerHTML = products.map(renderProductCard).join('');
    countEl.textContent = `${pagination.total} sản phẩm`;
    renderPagination(pagination);
  } catch {
    grid.innerHTML = `
      <div class="empty-state product-grid__empty">
        <p class="empty-state__title">Không tải được sản phẩm</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
    countEl.textContent = '';
  }
}

sortSelect.addEventListener('change', () => {
  setParam('sort', sortSelect.value);
  loadProducts();
});

renderCategoryFilters();
loadProducts();
