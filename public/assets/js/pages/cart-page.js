import * as cart from '../cart.js';
import { api } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';
import { getSavedCouponCode, saveCouponCode, validateCoupon } from '../lib/coupon-state.js';

const root = document.querySelector('[data-cart-root]');

// Discount preview for the code the shopper typed here. It is only a
// preview: checkout re-sends the code and the server recalculates it against
// the live prices before the order is created.
let appliedCoupon = null;

function renderEmpty() {
  root.innerHTML = `
    <div class="panel empty-state">
      <p class="empty-state__title">Giỏ hàng của bạn đang trống</p>
      <p>Hãy chọn thêm vài sản phẩm nhé.</p>
      <p><a class="btn btn--primary" href="./shop.html">Tiếp tục mua sắm</a></p>
    </div>`;
}

function renderItem(item) {
  const image = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.productName)}" width="68" height="68" loading="lazy" />`
    : '<span class="cart-item__no-image">Chưa có ảnh</span>';

  return `
    <div class="cart-item" data-variant-id="${item.variantId}">
      <div class="cart-item__product">
        <span class="cart-item__image">${image}</span>
        <div>
          <p class="cart-item__name">
            <a href="./product-details.html?slug=${encodeURIComponent(item.productSlug || '')}">${escapeHtml(item.productName)}</a>
          </p>
          ${item.variantName ? `<p class="cart-item__variant">${escapeHtml(item.variantName)}</p>` : ''}
          <p class="cart-item__unit">${formatCurrency(item.unitPrice)}</p>
        </div>
      </div>
      <div class="qty-stepper cart-item__qty">
        <button type="button" data-qty-decrease aria-label="Giảm số lượng">-</button>
        <input type="number" min="1" value="${item.quantity}" data-qty-input aria-label="Số lượng" />
        <button type="button" data-qty-increase aria-label="Tăng số lượng">+</button>
      </div>
      <div class="cart-item__line-total">${formatCurrency(item.unitPrice * item.quantity)}</div>
      <button type="button" class="cart-item__remove" data-remove aria-label="Xoá ${escapeHtml(item.productName)}">&times;</button>
    </div>`;
}

function render() {
  const items = cart.getItems();

  if (!items.length) {
    appliedCoupon = null;
    saveCouponCode('');
    renderEmpty();
    return;
  }

  const subtotal = cart.getTotal();
  const discount = appliedCoupon?.discount_amount || 0;
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  root.innerHTML = `
    <div class="cart-head">
      <div>
        <h1 class="cart-head__title">Giỏ hàng của bạn</h1>
        <p class="cart-head__count">${count} sản phẩm</p>
      </div>
      <div class="flow-steps">
        <span class="flow-steps__step is-current" data-step="1">Giỏ hàng</span>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step" data-step="2">Thanh toán</span>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step" data-step="3">Hoàn tất</span>
      </div>
    </div>

    <div class="cart-layout">
      <div class="panel-stack">
        <div class="panel">
          <div class="cart-items__head">
            <span>Sản phẩm</span><span>Số lượng</span><span>Tạm tính</span><span></span>
          </div>
          <div class="cart-items">${items.map(renderItem).join('')}</div>
          <div class="cart-items__foot">
            <a class="cart-items__back" href="./shop.html">&larr; Tiếp tục mua sắm</a>
            <button type="button" class="btn-quiet" data-clear-cart>Xoá toàn bộ giỏ hàng</button>
          </div>
        </div>

        <div class="panel" data-suggest-section hidden>
          <div class="section-head">
            <h2 class="section-head__title">Mua thêm</h2>
            <a class="section-head__more" href="./shop.html">Xem tất cả &rarr;</a>
          </div>
          <div class="cart-suggest" data-suggest-grid></div>
        </div>
      </div>

      <aside class="cart-summary">
        <div class="panel">
          <div class="section-head"><h2 class="section-head__title">Mã giảm giá</h2></div>
          <form class="cart-coupon" data-coupon-form novalidate>
            <label class="sr-only" for="cart-coupon-input">Mã giảm giá</label>
            <input class="input" id="cart-coupon-input" type="text" placeholder="Nhập mã" autocomplete="off"
              value="${escapeHtml(appliedCoupon?.code || getSavedCouponCode())}" data-coupon-input />
            ${appliedCoupon
              ? '<button type="button" class="btn btn--outline btn--sm" data-coupon-clear>Bỏ mã</button>'
              : '<button type="submit" class="btn btn--primary btn--sm">Áp dụng</button>'}
          </form>
          <p class="cart-coupon__message" data-coupon-message role="status">${
            appliedCoupon
              ? `Đã áp mã ${escapeHtml(appliedCoupon.code)} · giảm ${formatCurrency(appliedCoupon.discount_amount)}`
              : ''
          }</p>
        </div>

        <div class="panel">
          <div class="section-head"><h2 class="section-head__title">Tóm tắt đơn hàng</h2></div>
          <div class="summary-rows">
            <div class="summary-row"><span>Tạm tính (${count} sản phẩm)</span><span>${formatCurrency(subtotal)}</span></div>
            ${discount ? `<div class="summary-row summary-row--discount"><span>Mã ${escapeHtml(appliedCoupon.code)}</span><span>-${formatCurrency(discount)}</span></div>` : ''}
            <div class="summary-row summary-row--muted"><span>Phí giao hàng</span><span>Chọn ở bước thanh toán</span></div>
            <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(subtotal - discount)}</span></div>
          </div>
          <p class="summary-note">Chưa gồm phí giao hàng. Bạn chọn phương thức giao và thanh toán ở bước sau.</p>
          <p><a class="btn btn--primary btn--block" href="./checkout.html">Tiến hành thanh toán</a></p>
        </div>

        <div class="consult-card">
          <p class="consult-card__title">Cần đổi sản phẩm khác?</p>
          <p class="consult-card__text">Gọi hotline hoặc chat Zalo, nhân viên sẽ đổi giúp bạn trước khi giao.</p>
          <div class="consult-card__actions">
            <a class="btn btn--primary btn--sm" data-store-zalo-link href="./contact.html" hidden>Chat Zalo</a>
            <a class="btn btn--outline btn--sm" data-store-hotline-link href="./contact.html"><span>Gọi <span data-store-hotline>hotline</span></span></a>
          </div>
        </div>
      </aside>
    </div>`;

  wireInteractions();
  loadSuggestions();
}

function wireInteractions() {
  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const variantId = Number(btn.closest('[data-variant-id]').dataset.variantId);
      cart.removeItem(variantId);
    });
  });

  root.querySelector('[data-clear-cart]')?.addEventListener('click', () => {
    cart.clearCart();
  });

  root.querySelectorAll('.cart-item').forEach((row) => {
    const variantId = Number(row.dataset.variantId);
    const qtyInput = row.querySelector('[data-qty-input]');

    row.querySelector('[data-qty-decrease]')?.addEventListener('click', () => {
      cart.updateQuantity(variantId, Math.max(1, Number(qtyInput.value) - 1));
    });
    row.querySelector('[data-qty-increase]')?.addEventListener('click', () => {
      cart.updateQuantity(variantId, Number(qtyInput.value) + 1);
    });
    qtyInput.addEventListener('change', () => {
      cart.updateQuantity(variantId, Math.max(1, Number(qtyInput.value) || 1));
    });
  });

  root.querySelector('[data-coupon-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = root.querySelector('[data-coupon-input]');
    const messageEl = root.querySelector('[data-coupon-message]');
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    messageEl.classList.remove('is-error');
    messageEl.textContent = 'Đang kiểm tra mã…';

    const result = await validateCoupon(code, cart.getTotal());
    if (!result) {
      appliedCoupon = null;
      saveCouponCode('');
      messageEl.textContent = 'Mã không áp dụng được cho giỏ hàng này.';
      messageEl.classList.add('is-error');
      return;
    }

    appliedCoupon = result;
    saveCouponCode(result.code);
    render();
  });

  root.querySelector('[data-coupon-clear]')?.addEventListener('click', () => {
    appliedCoupon = null;
    saveCouponCode('');
    render();
  });
}

// "Mua thêm": real products from the catalogue that aren't in the cart yet.
async function loadSuggestions() {
  const section = root.querySelector('[data-suggest-section]');
  const grid = root.querySelector('[data-suggest-grid]');
  if (!section || !grid) return;

  const inCart = new Set(cart.getItems().map((item) => item.productSlug));

  try {
    const products = await api.get('/api/products?featured=true&limit=8');
    const suggestions = products.filter((product) => !inCart.has(product.slug)).slice(0, 4);
    if (!suggestions.length) return;

    const { renderProductCard } = await import('../lib/product-card.js');
    grid.innerHTML = suggestions.map(renderProductCard).join('');
    section.hidden = false;
  } catch {
    // Leave hidden.
  }
}

// A stored code has to be re-checked against the current subtotal, because
// changing quantities can push the order below the coupon's minimum.
async function restoreSavedCoupon() {
  const code = getSavedCouponCode();
  if (!code || !cart.getItems().length) return;
  const result = await validateCoupon(code, cart.getTotal());
  if (result) {
    appliedCoupon = result;
    render();
  } else {
    saveCouponCode('');
  }
}

window.addEventListener('cart:changed', () => {
  // Quantities changed, so any preview discount is stale.
  if (appliedCoupon) {
    const code = appliedCoupon.code;
    appliedCoupon = null;
    render();
    validateCoupon(code, cart.getTotal()).then((result) => {
      if (result) {
        appliedCoupon = result;
        render();
      } else {
        saveCouponCode('');
      }
    });
    return;
  }
  render();
});

render();
restoreSavedCoupon();
