import { api, ApiError } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';
import { observeReveal } from '../lib/reveal.js';
import { renderProductCard, renderCardSkeletons, discountPercent } from '../lib/product-card.js';
import { renderVoucherCard, wireCopyButtons } from '../lib/coupon.js';
import * as cart from '../cart.js';

const root = document.querySelector('[data-product-root]');
const slug = new URLSearchParams(window.location.search).get('slug');

let currentProduct = null;
let selectedVariantId = null;

function getSelectedVariant() {
  return currentProduct?.product_variants.find((v) => v.id === selectedVariantId) || null;
}

function stockBadge(variant) {
  if (!variant || variant.stock_quantity <= 0) return '<span class="badge badge--danger">Hết hàng</span>';
  if (variant.stock_quantity <= 5) return `<span class="badge badge--warning">Sắp hết hàng (còn ${variant.stock_quantity})</span>`;
  return '<span class="badge badge--success">Còn hàng</span>';
}

function renderNotFound() {
  root.innerHTML = `
    <div class="panel empty-state">
      <p class="empty-state__title">Không tìm thấy sản phẩm</p>
      <p>Sản phẩm này có thể đã ngừng kinh doanh hoặc đường dẫn không đúng.</p>
      <p><a class="btn btn--primary" href="./shop.html">Quay lại cửa hàng</a></p>
    </div>`;
}

function renderError() {
  root.innerHTML = `
    <div class="panel empty-state">
      <p class="empty-state__title">Không tải được sản phẩm</p>
      <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
    </div>`;
}

function renderFull() {
  const product = currentProduct;
  const variant = getSelectedVariant();
  const images = product.product_images || [];
  const hasVariantChoice = product.product_variants.length > 1;
  const off = discountPercent(product);

  document.title = `${product.meta_title || product.name} - Siêu Thị Sữa Thanh Hậu`;

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="./index.html">Trang chủ</a> /
      ${product.category ? `<a href="./shop.html?category=${encodeURIComponent(product.category.slug)}">${escapeHtml(product.category.name)}</a> /` : ''}
      <span>${escapeHtml(product.name)}</span>
    </nav>

    <div class="pdp">
      <div class="panel pdp-gallery">
        <div class="pdp-gallery__main">
          ${off ? `<span class="pdp-gallery__off">-${off}%</span>` : ''}
          ${images[0]
            ? `<img src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].alt_text || product.name)}" data-main-image />`
            : '<span class="pdp-gallery__placeholder">Chưa có ảnh sản phẩm</span>'}
        </div>
        ${images.length > 1
          ? `<div class="pdp-gallery__thumbs">
              ${images
                .map(
                  (img, i) => `
                <button type="button" class="pdp-gallery__thumb${i === 0 ? ' is-active' : ''}" data-thumb data-src="${escapeHtml(img.url)}">
                  <img src="${escapeHtml(img.url)}" alt="" loading="lazy" />
                </button>`,
                )
                .join('')}
            </div>`
          : ''}
      </div>

      <div class="panel pdp-buy">
        ${product.brand ? `<span class="pdp-buy__eyebrow">${escapeHtml(product.brand)}</span>` : ''}
        <h1 class="pdp-buy__title">${escapeHtml(product.name)}</h1>
        <div class="pdp-buy__meta">
          <span data-rating-summary>Đang tải đánh giá…</span>
          <span data-stock>${stockBadge(variant)}</span>
          ${variant ? `<span data-sku>SKU ${escapeHtml(variant.sku)}</span>` : ''}
        </div>

        <div class="pdp-buy__price price">
          <span class="price__now" data-price>${formatCurrency(variant?.price ?? product.base_price)}</span>
          ${off ? `<span class="price__was">${formatCurrency(product.compare_at_price)}</span>` : ''}
          ${off ? `<span class="price__save">Tiết kiệm ${formatCurrency(product.compare_at_price - product.base_price)}</span>` : ''}
        </div>

        ${hasVariantChoice
          ? `<div class="pdp-buy__group">
              <span class="pdp-buy__label">Phân loại</span>
              <div class="variant-pills">
                ${product.product_variants
                  .map(
                    (v) => `
                  <button type="button"
                    class="variant-pill${v.id === selectedVariantId ? ' is-active' : ''}${v.stock_quantity <= 0 ? ' is-disabled' : ''}"
                    data-variant-id="${v.id}">${escapeHtml(v.name)}
                    <span>${v.stock_quantity <= 0 ? 'hết hàng' : formatCurrency(v.price)}</span>
                  </button>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''}

        <div class="pdp-buy__group">
          <span class="pdp-buy__label">Số lượng</span>
          <div class="pdp-buy__actions">
            <div class="qty-stepper">
              <button type="button" data-qty-decrease aria-label="Giảm số lượng">-</button>
              <input type="number" min="1" value="1" data-qty-input aria-label="Số lượng" />
              <button type="button" data-qty-increase aria-label="Tăng số lượng">+</button>
            </div>
            <button type="button" class="btn btn--primary" data-add-to-cart ${!variant || variant.stock_quantity <= 0 ? 'disabled' : ''}>
              Thêm vào giỏ
            </button>
            <button type="button" class="btn btn--secondary" data-buy-now ${!variant || variant.stock_quantity <= 0 ? 'disabled' : ''}>
              Mua ngay
            </button>
          </div>
          <p class="pdp-buy__feedback" data-add-feedback role="status"></p>
        </div>

        ${product.short_description ? `<p class="pdp-buy__short-desc">${escapeHtml(product.short_description)}</p>` : ''}
      </div>

      <aside class="pdp-aside">
        <div class="panel">
          <div class="section-head"><h2 class="section-head__title">Thông tin nhanh</h2></div>
          <dl class="pdp-facts">
            ${product.brand ? `<div><dt>Thương hiệu</dt><dd>${escapeHtml(product.brand)}</dd></div>` : ''}
            ${product.category ? `<div><dt>Danh mục</dt><dd>${escapeHtml(product.category.name)}</dd></div>` : ''}
            <div><dt>Mã sản phẩm</dt><dd data-fact-sku>${variant ? escapeHtml(variant.sku) : '—'}</dd></div>
            <div><dt>Tồn kho</dt><dd data-fact-stock>${variant ? `${variant.stock_quantity} sản phẩm` : '—'}</dd></div>
          </dl>
        </div>

        <div class="panel" data-shipping-panel hidden>
          <div class="section-head"><h2 class="section-head__title">Giao hàng</h2></div>
          <div class="pdp-shipping" data-shipping-list></div>
        </div>

        <div class="panel">
          <div class="section-head"><h2 class="section-head__title">Cam kết của Thanh Hậu</h2></div>
          <ul class="assurance-list">
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6l7-3z"></path><path d="M9.2 12l2 2 3.6-4"></path></svg>
              Hàng nhập trực tiếp từ nhà phân phối, có tem chống hàng giả.
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="7" width="11" height="9" rx="1.6"></rect><path d="M13.5 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="1.7"></circle><circle cx="17" cy="18" r="1.7"></circle></svg>
              Đóng gói chống sốc, đổi mới nếu hộp móp do vận chuyển.
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 1 14.5 4.6"></path><path d="M4 6v6h6"></path></svg>
              Đổi trả trong 7 ngày nếu sản phẩm lỗi do nhà sản xuất.
            </li>
          </ul>
        </div>

        <div class="consult-card">
          <p class="consult-card__title">Cần tư vấn cho bé?</p>
          <p class="consult-card__text">Nhắn tháng tuổi và cân nặng của bé, nhân viên cửa hàng sẽ gợi ý loại phù hợp.</p>
          <div class="consult-card__actions">
            <a class="btn btn--primary btn--sm" data-store-zalo-link href="./contact.html" hidden>Chat Zalo</a>
            <a class="btn btn--outline btn--sm" data-store-hotline-link href="./contact.html"><span>Gọi <span data-store-hotline>hotline</span></span></a>
          </div>
        </div>

        <div class="panel" data-coupon-panel hidden>
          <div class="section-head"><h2 class="section-head__title">Mã giảm giá dùng được</h2></div>
          <div class="pdp-coupons" data-coupon-list></div>
        </div>
      </aside>
    </div>

    <div class="panel pdp-tabs">
      <div class="pdp-tabs__nav" role="tablist">
        <button type="button" class="pdp-tabs__tab is-active" data-tab="desc" role="tab" aria-selected="true">Mô tả sản phẩm</button>
        <button type="button" class="pdp-tabs__tab" data-tab="reviews" role="tab" aria-selected="false">Đánh giá</button>
      </div>
      <div class="pdp-tabs__panel" data-panel="desc" role="tabpanel">
        ${product.description
          ? `<div class="pdp-prose">${escapeHtml(product.description)}</div>`
          : '<p class="empty-state">Sản phẩm này chưa có mô tả chi tiết.</p>'}
      </div>
      <div class="pdp-tabs__panel" data-panel="reviews" role="tabpanel" hidden>
        <div data-reviews-root><div class="skeleton" style="height:80px"></div></div>
      </div>
    </div>

    <section class="panel" data-related-section hidden>
      <div class="section-head">
        <h2 class="section-head__title">Sản phẩm cùng danh mục</h2>
        ${product.category ? `<a class="section-head__more" href="./shop.html?category=${encodeURIComponent(product.category.slug)}">Xem thêm &rarr;</a>` : ''}
      </div>
      <div class="product-grid product-grid--5" data-related-grid>${renderCardSkeletons(5)}</div>
    </section>
  `;

  wireInteractions();
  observeReveal();
}

function updateVariantUI() {
  const variant = getSelectedVariant();

  const priceEl = root.querySelector('[data-price]');
  if (priceEl) priceEl.textContent = formatCurrency(variant?.price ?? currentProduct.base_price);

  const stockEl = root.querySelector('[data-stock]');
  if (stockEl) stockEl.innerHTML = stockBadge(variant);

  const skuEl = root.querySelector('[data-sku]');
  if (skuEl && variant) skuEl.textContent = `SKU ${variant.sku}`;

  const factSku = root.querySelector('[data-fact-sku]');
  if (factSku) factSku.textContent = variant ? variant.sku : '—';
  const factStock = root.querySelector('[data-fact-stock]');
  if (factStock) factStock.textContent = variant ? `${variant.stock_quantity} sản phẩm` : '—';

  root.querySelectorAll('.variant-pill').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.variantId) === selectedVariantId);
  });

  const disabled = !variant || variant.stock_quantity <= 0;
  root.querySelectorAll('[data-add-to-cart], [data-buy-now]').forEach((btn) => {
    btn.disabled = disabled;
  });
}

function addSelectedToCart() {
  const variant = getSelectedVariant();
  if (!variant) return false;
  const qtyInput = root.querySelector('[data-qty-input]');
  const quantity = Math.max(1, Number(qtyInput?.value) || 1);

  cart.addItem({
    variantId: variant.id,
    productSlug: currentProduct.slug,
    productName: currentProduct.name,
    variantName: variant.name,
    unitPrice: variant.price,
    imageUrl: currentProduct.product_images[0]?.url || null,
    quantity,
  });
  return true;
}

function wireInteractions() {
  root.querySelectorAll('[data-thumb]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-thumb]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const mainImg = root.querySelector('[data-main-image]');
      if (mainImg) mainImg.src = btn.dataset.src;
    });
  });

  root.querySelectorAll('.variant-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-disabled')) return;
      selectedVariantId = Number(btn.dataset.variantId);
      updateVariantUI();
    });
  });

  const qtyInput = root.querySelector('[data-qty-input]');
  root.querySelector('[data-qty-decrease]')?.addEventListener('click', () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
  });
  root.querySelector('[data-qty-increase]')?.addEventListener('click', () => {
    qtyInput.value = Number(qtyInput.value) + 1;
  });

  root.querySelector('[data-add-to-cart]')?.addEventListener('click', () => {
    if (!addSelectedToCart()) return;
    const feedback = root.querySelector('[data-add-feedback]');
    if (feedback) {
      feedback.textContent = 'Đã thêm vào giỏ hàng.';
      setTimeout(() => {
        feedback.textContent = '';
      }, 3000);
    }
  });

  // "Mua ngay" is the same add-to-cart, then straight to checkout - it does
  // not skip the cart step behind the scenes.
  root.querySelector('[data-buy-now]')?.addEventListener('click', () => {
    if (!addSelectedToCart()) return;
    window.location.href = './checkout.html';
  });

  root.querySelectorAll('.pdp-tabs__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      root.querySelectorAll('.pdp-tabs__tab').forEach((other) => {
        other.classList.toggle('is-active', other === tab);
        other.setAttribute('aria-selected', String(other === tab));
      });
      root.querySelectorAll('.pdp-tabs__panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
    });
  });
}

function renderReview(review) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  return `
    <div class="review-item">
      <div class="review-item__stars" aria-label="${review.rating} trên 5 sao">${stars}</div>
      ${review.title ? `<h3 class="review-item__title">${escapeHtml(review.title)}</h3>` : ''}
      <p class="review-item__content">${escapeHtml(review.content)}</p>
    </div>`;
}

// The rating shown in the meta row is averaged over the reviews actually
// loaded, and says so when there are more pages than the one fetched -
// no store-wide "4.8 sao" that nothing backs up.
async function loadReviews() {
  const reviewsRoot = root.querySelector('[data-reviews-root]');
  const summaryEl = root.querySelector('[data-rating-summary]');
  const tabButton = root.querySelector('[data-tab="reviews"]');
  if (!reviewsRoot) return;

  try {
    const { data: reviews, pagination } = await api.get(`/api/products/${encodeURIComponent(slug)}/reviews`, { raw: true });

    if (tabButton) tabButton.textContent = `Đánh giá (${pagination.total})`;

    if (!reviews.length) {
      if (summaryEl) summaryEl.textContent = 'Chưa có đánh giá';
      reviewsRoot.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có đánh giá nào</p>
          <p>Hãy là người đầu tiên đánh giá sản phẩm này.</p>
        </div>`;
      return;
    }

    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    const rounded = average.toFixed(1);
    const isPartial = pagination.total > reviews.length;

    if (summaryEl) {
      summaryEl.innerHTML = `<span class="pdp-buy__stars" aria-hidden="true">${'★'.repeat(Math.round(average))}</span> ${rounded} · ${pagination.total} đánh giá`;
    }

    reviewsRoot.innerHTML = `
      <div class="pdp-reviews__summary">
        <span class="pdp-reviews__score">${rounded}</span>
        <span>
          <span class="pdp-reviews__stars" aria-hidden="true">${'★'.repeat(Math.round(average))}${'☆'.repeat(5 - Math.round(average))}</span>
          <span class="pdp-reviews__count">${
            isPartial
              ? `trung bình của ${reviews.length} đánh giá mới nhất · ${pagination.total} đánh giá`
              : `${pagination.total} đánh giá`
          }</span>
        </span>
      </div>
      ${reviews.map(renderReview).join('')}`;
  } catch {
    if (summaryEl) summaryEl.textContent = '';
    reviewsRoot.innerHTML = '<div class="empty-state"><p class="empty-state__title">Không tải được đánh giá</p></div>';
  }
}

async function loadShipping() {
  const panel = root.querySelector('[data-shipping-panel]');
  const list = root.querySelector('[data-shipping-list]');
  if (!panel || !list) return;

  try {
    const methods = await api.get('/api/checkout/shipping-methods');
    if (!methods.length) return;
    list.innerHTML = methods
      .map(
        (method) => `
        <div class="pdp-shipping__row">
          <span class="pdp-shipping__name">${escapeHtml(method.name)}
            ${method.description ? `<span class="pdp-shipping__desc">${escapeHtml(method.description)}</span>` : ''}
          </span>
          <span class="pdp-shipping__fee">${Number(method.fee) > 0 ? formatCurrency(method.fee) : 'Miễn phí'}</span>
        </div>`,
      )
      .join('');
    panel.hidden = false;
  } catch {
    // Leave hidden.
  }
}

async function loadCoupons() {
  const panel = root.querySelector('[data-coupon-panel]');
  const list = root.querySelector('[data-coupon-list]');
  if (!panel || !list) return;

  try {
    const coupons = await api.get('/api/coupons?limit=3');
    if (!coupons.length) return;
    list.innerHTML = coupons.map(renderVoucherCard).join('');
    wireCopyButtons(list);
    panel.hidden = false;
  } catch {
    // Leave hidden.
  }
}

async function loadRelated() {
  const section = root.querySelector('[data-related-section]');
  const grid = root.querySelector('[data-related-grid]');
  if (!section || !grid || !currentProduct.category) return;

  try {
    const products = await api.get(
      `/api/products?category=${encodeURIComponent(currentProduct.category.slug)}&limit=6`,
    );
    const others = products.filter((product) => product.slug !== currentProduct.slug).slice(0, 5);
    if (!others.length) return;
    grid.innerHTML = others.map(renderProductCard).join('');
    section.hidden = false;
  } catch {
    // Leave hidden.
  }
}

async function init() {
  if (!slug) {
    renderNotFound();
    return;
  }

  try {
    const product = await api.get(`/api/products/${encodeURIComponent(slug)}`);
    currentProduct = product;
    selectedVariantId =
      product.product_variants.find((v) => v.stock_quantity > 0)?.id ?? product.product_variants[0]?.id ?? null;

    renderFull();
    loadReviews();
    loadShipping();
    loadCoupons();
    loadRelated();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      renderNotFound();
    } else {
      renderError();
    }
  }
}

init();
