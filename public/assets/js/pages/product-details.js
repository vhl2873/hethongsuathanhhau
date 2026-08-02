import { api, ApiError } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';
import { observeReveal } from '../lib/reveal.js';
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
    <div class="empty-state">
      <p class="empty-state__title">Không tìm thấy sản phẩm</p>
      <p>Sản phẩm này có thể đã ngừng kinh doanh hoặc đường dẫn không đúng.</p>
      <a class="btn btn--primary" href="./shop.html">Quay lại cửa hàng</a>
    </div>`;
}

function renderError() {
  root.innerHTML = `
    <div class="empty-state">
      <p class="empty-state__title">Không tải được sản phẩm</p>
      <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
    </div>`;
}

function renderFull() {
  const product = currentProduct;
  const variant = getSelectedVariant();
  const images = product.product_images.length ? product.product_images : [];
  const hasVariantChoice = product.product_variants.length > 1;

  document.title = `${product.meta_title || product.name} - Siêu Thị Sữa Thanh Hậu`;

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="./index.html">Trang chủ</a> /
      ${product.category ? `<a href="./shop.html?category=${encodeURIComponent(product.category.slug)}">${escapeHtml(product.category.name)}</a> /` : ''}
      <span>${escapeHtml(product.name)}</span>
    </nav>

    <div class="product-layout">
      <div class="product-gallery">
        <div class="product-gallery__main">
          ${images[0]
            ? `<img src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].alt_text || product.name)}" data-main-image />`
            : '<div class="product-gallery__placeholder">Chưa có ảnh sản phẩm</div>'}
        </div>
        ${images.length > 1 ? `
          <div class="product-gallery__thumbs">
            ${images
              .map(
                (img, i) => `
              <button type="button" class="product-gallery__thumb${i === 0 ? ' is-active' : ''}" data-thumb data-src="${escapeHtml(img.url)}">
                <img src="${escapeHtml(img.url)}" alt="" loading="lazy" />
              </button>`,
              )
              .join('')}
          </div>` : ''}
      </div>

      <div class="product-info">
        <h1 class="product-info__name">${escapeHtml(product.name)}</h1>
        ${product.brand ? `<p class="product-info__brand">Thương hiệu: ${escapeHtml(product.brand)}</p>` : ''}

        <div class="product-info__price">
          <span class="product-info__price-current" data-price>${formatCurrency(variant?.price ?? product.base_price)}</span>
        </div>

        <div class="product-info__stock" data-stock>${stockBadge(variant)}</div>

        ${hasVariantChoice ? `
          <div class="product-info__variants">
            <span class="product-info__variants-label">Phân loại:</span>
            <div class="variant-pills">
              ${product.product_variants
                .map(
                  (v) => `
                <button type="button"
                  class="variant-pill${v.id === selectedVariantId ? ' is-active' : ''}${v.stock_quantity <= 0 ? ' is-disabled' : ''}"
                  data-variant-id="${v.id}">${escapeHtml(v.name)}</button>`,
                )
                .join('')}
            </div>
          </div>` : ''}

        <div class="product-info__actions">
          <div class="qty-stepper">
            <button type="button" data-qty-decrease aria-label="Giảm số lượng">-</button>
            <input type="number" min="1" value="1" data-qty-input aria-label="Số lượng" />
            <button type="button" data-qty-increase aria-label="Tăng số lượng">+</button>
          </div>
          <button type="button" class="btn btn--primary" data-add-to-cart ${!variant || variant.stock_quantity <= 0 ? 'disabled' : ''}>
            Thêm vào giỏ
          </button>
        </div>
        <p class="product-info__feedback" data-add-feedback role="status"></p>

        ${product.short_description ? `<p class="product-info__short-desc">${escapeHtml(product.short_description)}</p>` : ''}
      </div>
    </div>

    ${product.description ? `
      <section class="product-description" data-reveal>
        <h2 class="page-title">Mô tả sản phẩm</h2>
        <div class="product-description__content">${escapeHtml(product.description)}</div>
      </section>` : ''}

    <section class="product-reviews" data-reveal>
      <h2 class="page-title">Đánh giá từ khách hàng</h2>
      <div data-reviews-root>
        <div class="skeleton" style="height:80px"></div>
      </div>
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

  root.querySelectorAll('.variant-pill').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.variantId) === selectedVariantId);
  });

  const addBtn = root.querySelector('[data-add-to-cart]');
  if (addBtn) addBtn.disabled = !variant || variant.stock_quantity <= 0;
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
    const variant = getSelectedVariant();
    if (!variant) return;
    const quantity = Math.max(1, Number(qtyInput.value) || 1);

    cart.addItem({
      variantId: variant.id,
      productSlug: currentProduct.slug,
      productName: currentProduct.name,
      variantName: variant.name,
      unitPrice: variant.price,
      imageUrl: currentProduct.product_images[0]?.url || null,
      quantity,
    });

    const feedback = root.querySelector('[data-add-feedback]');
    if (feedback) {
      feedback.textContent = 'Đã thêm vào giỏ hàng.';
      setTimeout(() => {
        feedback.textContent = '';
      }, 3000);
    }
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

async function loadReviews() {
  const reviewsRoot = root.querySelector('[data-reviews-root]');
  if (!reviewsRoot) return;

  try {
    const { data: reviews } = await api.get(`/api/products/${encodeURIComponent(slug)}/reviews`, { raw: true });
    reviewsRoot.innerHTML = reviews.length
      ? reviews.map(renderReview).join('')
      : `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có đánh giá nào</p>
          <p>Hãy là người đầu tiên đánh giá sản phẩm này.</p>
        </div>`;
  } catch {
    reviewsRoot.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được đánh giá</p>
      </div>`;
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
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      renderNotFound();
    } else {
      renderError();
    }
  }
}

init();
