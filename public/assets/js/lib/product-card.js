import { escapeHtml, formatCurrency } from './format.js';

// One product card markup for every grid on the site (home rails, shop
// results, related products) so a card looks identical wherever it lands.
// Only fields the API actually returns are rendered: the discount badge is
// computed from compare_at_price, the eyebrow falls back to the category
// when a product has no brand recorded, and there is no rating line because
// the list endpoint doesn't carry review aggregates.

export function discountPercent(product) {
  const was = Number(product.compare_at_price) || 0;
  const now = Number(product.base_price) || 0;
  if (!was || was <= now) return 0;
  return Math.round(((was - now) / was) * 100);
}

export function renderProductCard(product) {
  const off = discountPercent(product);
  const eyebrow = product.brand || product.category?.name || '';

  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" width="240" height="240" loading="lazy" />`
    : '<span class="product-card__no-image">Chưa có ảnh</span>';

  return `
    <a class="product-card" href="./product-details.html?slug=${encodeURIComponent(product.slug)}">
      <span class="product-card__plate">
        ${image}
        ${off ? `<span class="product-card__off">-${off}%</span>` : ''}
      </span>
      ${eyebrow ? `<span class="product-card__brand">${escapeHtml(eyebrow)}</span>` : ''}
      <span class="product-card__name">${escapeHtml(product.name)}</span>
      <span class="price">
        <span class="price__now">${formatCurrency(product.base_price)}</span>
        ${off ? `<span class="price__was">${formatCurrency(product.compare_at_price)}</span>` : ''}
      </span>
      <span class="product-card__cta">Chọn mua</span>
    </a>`;
}

export function renderCardSkeletons(count) {
  return Array.from({ length: count })
    .map(() => '<div class="skeleton product-card-skeleton"></div>')
    .join('');
}
