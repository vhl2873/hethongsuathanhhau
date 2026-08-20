import { api } from '../lib/api.js';
import { escapeHtml, formatCurrency } from '../lib/format.js';
import { renderProductCard, renderCardSkeletons } from '../lib/product-card.js';

// Every facet lives in the URL, so a filtered listing can be bookmarked,
// shared, and reached from the header search form. Only facets the API can
// really apply are offered: category, brand, price range, search and sort.
const grid = document.querySelector('[data-product-grid]');
const paginationEl = document.querySelector('[data-pagination]');
const countEl = document.querySelector('[data-result-count]');
const sortSelect = document.querySelector('[data-sort-select]');
const categoryFilterEl = document.querySelector('[data-category-filter]');
const brandPanel = document.querySelector('[data-brand-panel]');
const brandFilterEl = document.querySelector('[data-brand-filter]');
const priceForm = document.querySelector('[data-price-filter]');
const activeFiltersEl = document.querySelector('[data-active-filters]');
const breadcrumbEl = document.querySelector('[data-breadcrumb-current]');

let categoryIndex = new Map();

function getParams() {
  return new URLSearchParams(window.location.search);
}

function setParams(mutate) {
  const params = getParams();
  mutate(params);
  params.delete('page');
  const query = params.toString();
  window.history.pushState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  render();
}

function selectedBrands() {
  const raw = getParams().get('brand') || '';
  return raw.split(',').map((brand) => brand.trim()).filter(Boolean);
}

// ------------------------------------------------------------- category tree
async function renderCategoryFilters() {
  try {
    const categories = await api.get('/api/categories');
    const activeSlug = getParams().get('category');

    categoryIndex = new Map();
    const items = [
      `<li><a class="filter-list__link${!activeSlug ? ' is-active' : ''}" href="./shop.html">Tất cả sản phẩm</a></li>`,
    ];

    for (const category of categories) {
      categoryIndex.set(category.slug, category.name);
      items.push(categoryLink(category, activeSlug, false));
      for (const child of category.children || []) {
        categoryIndex.set(child.slug, child.name);
        items.push(categoryLink(child, activeSlug, true));
      }
    }

    categoryFilterEl.innerHTML = items.join('');
    updateBreadcrumb();
    renderActiveFilters();
  } catch {
    categoryFilterEl.innerHTML = '<li class="filter-list__empty">Không tải được danh mục.</li>';
  }
}

function categoryLink(category, activeSlug, isChild) {
  const isActive = activeSlug === category.slug;
  const params = getParams();
  params.set('category', category.slug);
  params.delete('page');
  return `<li>
    <a class="filter-list__link${isChild ? ' filter-list__link--child' : ''}${isActive ? ' is-active' : ''}"
       href="./shop.html?${params.toString()}">${escapeHtml(category.name)}</a>
  </li>`;
}

function updateBreadcrumb() {
  if (!breadcrumbEl) return;
  const slug = getParams().get('category');
  const name = slug ? categoryIndex.get(slug) : null;
  breadcrumbEl.textContent = name || 'Cửa hàng';
}

// ------------------------------------------------------------------- brands
async function renderBrandFilters() {
  if (!brandFilterEl || !brandPanel) return;

  try {
    const brands = await api.get('/api/products/brands');
    if (!brands.length) return;

    const active = selectedBrands();
    brandFilterEl.innerHTML = brands
      .map(
        (brand) => `
        <label class="filter-check">
          <input type="checkbox" value="${escapeHtml(brand.name)}" ${active.includes(brand.name) ? 'checked' : ''} />
          <span>${escapeHtml(brand.name)}</span>
          <span class="filter-check__count">${brand.count}</span>
        </label>`,
      )
      .join('');
    brandPanel.hidden = false;

    brandFilterEl.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        const checked = Array.from(brandFilterEl.querySelectorAll('input:checked')).map((el) => el.value);
        setParams((params) => {
          if (checked.length) params.set('brand', checked.join(','));
          else params.delete('brand');
        });
      });
    });
  } catch {
    // Older API build without the facet endpoint: leave the panel hidden
    // rather than showing a filter that can't be applied.
  }
}

// ------------------------------------------------------------- active chips
function renderActiveFilters() {
  if (!activeFiltersEl) return;
  const params = getParams();
  const chips = [];

  const categorySlug = params.get('category');
  if (categorySlug) {
    chips.push({ label: categoryIndex.get(categorySlug) || categorySlug, key: 'category' });
  }
  for (const brand of selectedBrands()) {
    chips.push({ label: brand, key: 'brand', value: brand });
  }
  const search = params.get('search');
  if (search) chips.push({ label: `“${search}”`, key: 'search' });

  const min = Number(params.get('minPrice')) || 0;
  const max = Number(params.get('maxPrice')) || 0;
  if (min || max) {
    const label = min && max
      ? `${formatCurrency(min)} – ${formatCurrency(max)}`
      : min
        ? `Từ ${formatCurrency(min)}`
        : `Đến ${formatCurrency(max)}`;
    chips.push({ label, key: 'price' });
  }

  if (!chips.length) {
    activeFiltersEl.hidden = true;
    return;
  }

  activeFiltersEl.innerHTML =
    '<span class="shop-toolbar__chips-label">Đang lọc:</span>' +
    chips
      .map(
        (chip) => `
        <span class="chip chip--token">${escapeHtml(chip.label)}
          <button type="button" aria-label="Bỏ lọc ${escapeHtml(chip.label)}" data-clear="${chip.key}" ${chip.value ? `data-clear-value="${escapeHtml(chip.value)}"` : ''}>&times;</button>
        </span>`,
      )
      .join('') +
    '<button type="button" class="btn-quiet" data-clear="all">Xoá tất cả</button>';
  activeFiltersEl.hidden = false;

  activeFiltersEl.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.clear;
      setParams((params) => {
        if (key === 'all') {
          ['category', 'brand', 'search', 'minPrice', 'maxPrice'].forEach((param) => params.delete(param));
        } else if (key === 'price') {
          params.delete('minPrice');
          params.delete('maxPrice');
        } else if (key === 'brand' && btn.dataset.clearValue) {
          const remaining = selectedBrands().filter((brand) => brand !== btn.dataset.clearValue);
          if (remaining.length) params.set('brand', remaining.join(','));
          else params.delete('brand');
        } else {
          params.delete(key);
        }
      });
      syncControls();
    });
  });
}

// Keeps the sidebar controls showing what the URL says, after a chip is
// removed or the browser Back button changes the query string.
function syncControls() {
  const params = getParams();
  if (sortSelect) sortSelect.value = params.get('sort') || 'newest';
  if (priceForm) {
    priceForm.elements.minPrice.value = params.get('minPrice') || '';
    priceForm.elements.maxPrice.value = params.get('maxPrice') || '';
  }
  const active = selectedBrands();
  brandFilterEl?.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = active.includes(input.value);
  });
  categoryFilterEl?.querySelectorAll('.filter-list__link').forEach((link) => {
    const slug = new URL(link.href, window.location.origin).searchParams.get('category');
    link.classList.toggle('is-active', (slug || null) === (params.get('category') || null));
  });
  updateBreadcrumb();
}

// ------------------------------------------------------------------ results
function renderSkeleton() {
  grid.innerHTML = renderCardSkeletons(8);
  countEl.textContent = 'Đang tải sản phẩm…';
  paginationEl.innerHTML = '';
}

function renderPagination(pagination) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  const buttons = [];
  if (page > 1) buttons.push(`<button type="button" class="pagination__page" data-page="${page - 1}" aria-label="Trang trước">&larr;</button>`);
  for (let p = 1; p <= totalPages; p += 1) {
    buttons.push(
      `<button type="button" class="pagination__page${p === page ? ' is-active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`,
    );
  }
  if (page < totalPages) buttons.push(`<button type="button" class="pagination__page" data-page="${page + 1}" aria-label="Trang sau">&rarr;</button>`);
  paginationEl.innerHTML = buttons.join('');

  paginationEl.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const params = getParams();
      params.set('page', btn.dataset.page);
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function loadProducts() {
  renderSkeleton();
  const params = getParams();

  const query = new URLSearchParams();
  for (const key of ['category', 'search', 'brand', 'minPrice', 'maxPrice']) {
    if (params.get(key)) query.set(key, params.get(key));
  }
  query.set('sort', params.get('sort') || 'newest');
  query.set('page', params.get('page') || '1');
  query.set('limit', '12');

  try {
    const { data: products, pagination } = await api.get(`/api/products?${query.toString()}`, { raw: true });

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Không tìm thấy sản phẩm phù hợp</p>
          <p>Thử bỏ bớt bộ lọc hoặc tìm với từ khoá khác.</p>
        </div>`;
      countEl.textContent = 'Không có sản phẩm nào';
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

function render() {
  syncControls();
  renderActiveFilters();
  loadProducts();
}

sortSelect?.addEventListener('change', () => {
  setParams((params) => params.set('sort', sortSelect.value));
});

priceForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const min = priceForm.elements.minPrice.value.trim();
  const max = priceForm.elements.maxPrice.value.trim();
  setParams((params) => {
    if (min) params.set('minPrice', min);
    else params.delete('minPrice');
    if (max) params.set('maxPrice', max);
    else params.delete('maxPrice');
  });
});

document.querySelector('[data-filter-toggle]')?.addEventListener('click', (event) => {
  const panels = document.querySelector('[data-filter-panels]');
  const isOpen = panels.classList.toggle('is-open');
  event.currentTarget.setAttribute('aria-expanded', String(isOpen));
});

window.addEventListener('popstate', render);

renderCategoryFilters();
renderBrandFilters();
render();
