import * as cart from '../cart.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-cart-root]');

function renderEmpty() {
  root.innerHTML = `
    <div class="empty-state">
      <p class="empty-state__title">Giỏ hàng của bạn đang trống</p>
      <p>Hãy chọn thêm vài sản phẩm nhé.</p>
      <a class="btn btn--primary" href="./shop.html">Tiếp tục mua sắm</a>
    </div>`;
}

function renderItem(item) {
  const image = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.productName)}" width="80" height="80" loading="lazy" />`
    : '<div class="cart-item__no-image">Chưa có ảnh</div>';

  return `
    <div class="cart-item" data-variant-id="${item.variantId}">
      <div class="cart-item__image">${image}</div>
      <div class="cart-item__info">
        <p class="cart-item__name">${escapeHtml(item.productName)}</p>
        ${item.variantName ? `<p class="cart-item__variant">${escapeHtml(item.variantName)}</p>` : ''}
        <button type="button" class="cart-item__remove" data-remove>Xóa</button>
      </div>
      <div class="qty-stepper cart-item__qty">
        <button type="button" data-qty-decrease aria-label="Giảm số lượng">-</button>
        <input type="number" min="1" value="${item.quantity}" data-qty-input aria-label="Số lượng" />
        <button type="button" data-qty-increase aria-label="Tăng số lượng">+</button>
      </div>
      <div class="cart-item__line-total">${formatCurrency(item.unitPrice * item.quantity)}</div>
    </div>`;
}

function render() {
  const items = cart.getItems();

  if (!items.length) {
    renderEmpty();
    return;
  }

  root.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">${items.map(renderItem).join('')}</div>
      <aside class="cart-summary card">
        <h2 class="cart-summary__heading">Tóm tắt đơn hàng</h2>
        <div class="cart-summary__row">
          <span>Tạm tính</span>
          <span>${formatCurrency(cart.getTotal())}</span>
        </div>
        <p class="cart-summary__note">Phí vận chuyển và mã giảm giá sẽ được tính ở bước thanh toán.</p>
        <a class="btn btn--primary cart-summary__checkout" href="./checkout.html">Tiến hành thanh toán</a>
      </aside>
    </div>`;

  wireInteractions();
}

function wireInteractions() {
  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const variantId = Number(btn.closest('[data-variant-id]').dataset.variantId);
      cart.removeItem(variantId);
    });
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
}

window.addEventListener('cart:changed', render);
render();
