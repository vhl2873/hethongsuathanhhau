import { escapeHtml, formatCurrency } from './format.js';

// Shared rendering for the coupon cards on the home page and the promotions
// page. Everything shown comes from GET /api/coupons - the shop's real
// active codes - so an empty list means the section is hidden rather than
// filled with invented discounts.

function compactVnd(value) {
  const n = Number(value) || 0;
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}K`;
  return formatCurrency(n);
}

export function couponBigLabel(coupon) {
  return coupon.discount_type === 'percentage' ? `${Number(coupon.discount_value)}%` : compactVnd(coupon.discount_value);
}

export function couponTitle(coupon) {
  if (coupon.description) return coupon.description;
  if (coupon.discount_type === 'percentage') {
    const cap = coupon.max_discount_amount ? ` tối đa ${compactVnd(coupon.max_discount_amount)}` : '';
    return `Giảm ${Number(coupon.discount_value)}%${cap}`;
  }
  return `Giảm ${formatCurrency(coupon.discount_value)}`;
}

export function couponCondition(coupon) {
  if (coupon.min_order_amount > 0) return `Đơn từ ${formatCurrency(coupon.min_order_amount)}`;
  return 'Áp dụng cho mọi đơn hàng';
}

function expiryNote(coupon) {
  if (!coupon.expires_at) return '';
  const date = new Date(coupon.expires_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return ` · đến ${date}`;
}

export function renderVoucherCard(coupon) {
  return `
    <div class="voucher-card">
      <div class="voucher-card__stub">
        <span class="voucher-card__big">${escapeHtml(couponBigLabel(coupon))}</span>
        <span class="voucher-card__stub-label">GIẢM</span>
      </div>
      <div class="voucher-card__body">
        <p class="voucher-card__title">${escapeHtml(couponTitle(coupon))}</p>
        <p class="voucher-card__cond">${escapeHtml(couponCondition(coupon) + expiryNote(coupon))}</p>
        <div class="voucher-card__foot">
          <span class="voucher-card__code">${escapeHtml(coupon.code)}</span>
          <button type="button" class="voucher-card__copy" data-copy-code="${escapeHtml(coupon.code)}">Sao chép</button>
        </div>
      </div>
    </div>`;
}

// Copying the code is the honest version of the design's "Lưu mã" button:
// there is no per-shopper coupon wallet, so the useful action is putting the
// code on the clipboard ready for the checkout field.
export function wireCopyButtons(container) {
  container.querySelectorAll('[data-copy-code]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.copyCode;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Đã sao chép';
      } catch {
        btn.textContent = code;
      }
      setTimeout(() => {
        btn.textContent = 'Sao chép';
      }, 2500);
    });
  });
}
