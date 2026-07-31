import * as cart from '../cart.js';
import { api, ApiError } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';
import { validateCheckoutForm } from '../lib/validators.js';

const root = document.querySelector('[data-checkout-root]');

let appliedCoupon = null;

function getSubtotal() {
  return cart.getTotal();
}
function getDiscount() {
  return appliedCoupon?.discount_amount || 0;
}
function getTotal() {
  return getSubtotal() - getDiscount();
}

// Simplified, request-style checkout: the store calls the customer to
// confirm delivery method/fee and payment method afterward, so this form
// only collects contact info + address - no shipping/payment method
// selection step (those get set by an admin on the order later).
function init() {
  const items = cart.getItems();
  if (!items.length) {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Giỏ hàng đang trống</p>
        <p>Vui lòng thêm sản phẩm trước khi thanh toán.</p>
        <a class="btn btn--primary" href="./shop.html">Quay lại cửa hàng</a>
      </div>`;
    return;
  }

  renderForm(items);
}

function renderForm(items) {
  root.innerHTML = `
    <form class="checkout-layout" data-checkout-form novalidate>
      <div class="checkout-form">
        <section class="card checkout-section">
          <h2 class="checkout-section__heading">Thông tin nhận hàng</h2>
          <div class="field">
            <label class="field__label" for="guestName">Họ tên *</label>
            <input class="input" type="text" id="guestName" name="guestName" required />
            <span class="field__error" data-error="guestName"></span>
          </div>
          <div class="field">
            <label class="field__label" for="guestPhone">Số điện thoại *</label>
            <input class="input" type="tel" id="guestPhone" name="guestPhone" required />
            <span class="field__error" data-error="guestPhone"></span>
          </div>
          <div class="field">
            <label class="field__label" for="guestEmail">Email (không bắt buộc)</label>
            <input class="input" type="email" id="guestEmail" name="guestEmail" />
            <span class="field__error" data-error="guestEmail"></span>
          </div>
          <div class="field">
            <label class="field__label" for="addressLine">Địa chỉ *</label>
            <input class="input" type="text" id="addressLine" name="addressLine" required />
            <span class="field__error" data-error="addressLine"></span>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="ward">Phường/Xã</label>
              <input class="input" type="text" id="ward" name="ward" />
            </div>
            <div class="field">
              <label class="field__label" for="district">Quận/Huyện</label>
              <input class="input" type="text" id="district" name="district" />
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="province">Tỉnh/Thành phố *</label>
            <input class="input" type="text" id="province" name="province" required />
            <span class="field__error" data-error="province"></span>
          </div>
          <div class="field">
            <label class="field__label" for="note">Ghi chú (không bắt buộc)</label>
            <textarea class="textarea" id="note" name="note" placeholder="Ví dụ: khung giờ tiện nhận hàng, ghi chú vận chuyển..."></textarea>
          </div>
        </section>

        <div class="alert alert--info checkout-note">
          Sau khi gửi yêu cầu, nhân viên cửa hàng sẽ gọi điện xác nhận đơn hàng, phí vận chuyển và phương thức thanh toán phù hợp với bạn.
        </div>
      </div>

      <aside class="checkout-summary card">
        <h2 class="checkout-section__heading">Đơn hàng của bạn</h2>
        <ul class="checkout-summary__items">
          ${items
            .map(
              (item) => `
            <li>
              <span>${escapeHtml(item.productName)}${item.variantName ? ` (${escapeHtml(item.variantName)})` : ''} × ${item.quantity}</span>
              <span>${formatCurrency(item.unitPrice * item.quantity)}</span>
            </li>`,
            )
            .join('')}
        </ul>

        <div class="checkout-coupon">
          <input class="input" type="text" placeholder="Mã giảm giá" data-coupon-input />
          <button type="button" class="btn btn--outline" data-coupon-apply>Áp dụng</button>
        </div>
        <p class="checkout-coupon__message" data-coupon-message></p>

        <div class="checkout-summary__totals">
          <div class="checkout-summary__row"><span>Tạm tính</span><span data-subtotal>${formatCurrency(getSubtotal())}</span></div>
          <div class="checkout-summary__row" data-discount-row hidden><span>Giảm giá</span><span data-discount>-${formatCurrency(0)}</span></div>
          <div class="checkout-summary__row checkout-summary__row--muted"><span>Phí vận chuyển</span><span>Xác nhận qua điện thoại</span></div>
          <div class="checkout-summary__row checkout-summary__row--total"><span>Tạm tính (chưa gồm phí ship)</span><span data-total>${formatCurrency(getTotal())}</span></div>
        </div>

        <div class="alert alert--danger" data-submit-error hidden></div>
        <button type="submit" class="btn btn--primary checkout-summary__submit" data-submit>Gửi yêu cầu đặt hàng</button>
      </aside>
    </form>`;

  wireForm(items);
}

function wireForm(items) {
  const form = root.querySelector('[data-checkout-form]');

  root.querySelector('[data-coupon-apply]').addEventListener('click', async () => {
    const code = root.querySelector('[data-coupon-input]').value.trim();
    const messageEl = root.querySelector('[data-coupon-message]');
    if (!code) return;

    try {
      const result = await api.post('/api/checkout/validate-coupon', { code, subtotal: getSubtotal() });
      appliedCoupon = result;
      messageEl.textContent = `Đã áp dụng mã "${result.code}".`;
      messageEl.classList.remove('is-error');
    } catch (err) {
      appliedCoupon = null;
      messageEl.textContent = err instanceof ApiError ? err.message : 'Không áp dụng được mã giảm giá.';
      messageEl.classList.add('is-error');
    }
    updateTotals();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSubmit(items);
  });
}

function updateTotals() {
  root.querySelector('[data-total]').textContent = formatCurrency(getTotal());

  const discountRow = root.querySelector('[data-discount-row]');
  if (getDiscount() > 0) {
    discountRow.hidden = false;
    root.querySelector('[data-discount]').textContent = `-${formatCurrency(getDiscount())}`;
  } else {
    discountRow.hidden = true;
  }
}

function clearFieldErrors() {
  root.querySelectorAll('[data-error]').forEach((el) => {
    el.textContent = '';
  });
}

function showFieldErrors(errors) {
  for (const [field, message] of Object.entries(errors)) {
    const el = root.querySelector(`[data-error="${field}"]`);
    if (el) el.textContent = message;
  }
}

async function handleSubmit(items) {
  const form = root.querySelector('[data-checkout-form]');
  const formData = new FormData(form);
  const values = {
    guestName: formData.get('guestName').trim(),
    guestPhone: formData.get('guestPhone').trim(),
    guestEmail: formData.get('guestEmail').trim(),
    addressLine: formData.get('addressLine').trim(),
    ward: formData.get('ward').trim(),
    district: formData.get('district').trim(),
    province: formData.get('province').trim(),
    note: formData.get('note').trim(),
  };

  clearFieldErrors();
  const errors = validateCheckoutForm(values);
  if (Object.keys(errors).length) {
    showFieldErrors(errors);
    return;
  }

  const submitBtn = root.querySelector('[data-submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang gửi...';
  root.querySelector('[data-submit-error]').hidden = true;

  try {
    const result = await api.post('/api/checkout', {
      guestName: values.guestName,
      guestPhone: values.guestPhone,
      guestEmail: values.guestEmail || undefined,
      shippingAddress: {
        address_line: values.addressLine,
        ward: values.ward,
        district: values.district,
        province: values.province,
      },
      note: values.note || undefined,
      couponCode: appliedCoupon?.code,
      items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    });

    cart.clearCart();
    renderConfirmation(result);
  } catch (err) {
    const errorEl = root.querySelector('[data-submit-error]');
    errorEl.hidden = false;
    errorEl.textContent = err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Gửi yêu cầu đặt hàng';
  }
}

function renderConfirmation(result) {
  root.innerHTML = `
    <div class="checkout-confirmation card">
      <span class="checkout-confirmation__badge">⏳ Chờ xác nhận</span>
      <h2 class="checkout-confirmation__title">Đã gửi yêu cầu đặt hàng!</h2>
      <p>Mã đơn hàng của bạn: <strong>${escapeHtml(result.order_number)}</strong></p>
      <div class="checkout-summary__totals">
        <div class="checkout-summary__row"><span>Tạm tính</span><span>${formatCurrency(result.subtotal)}</span></div>
        ${result.discount_amount > 0 ? `<div class="checkout-summary__row"><span>Giảm giá</span><span>-${formatCurrency(result.discount_amount)}</span></div>` : ''}
        <div class="checkout-summary__row checkout-summary__row--muted"><span>Phí vận chuyển</span><span>Xác nhận qua điện thoại</span></div>
      </div>
      <p class="checkout-confirmation__note">Đơn hàng của bạn đang <strong>chờ cửa hàng xác nhận</strong>. Nhân viên sẽ gọi điện trong thời gian sớm nhất để xác nhận đơn hàng, phí vận chuyển và phương thức thanh toán.</p>
      <a class="btn btn--primary" href="./index.html">Về trang chủ</a>
    </div>`;
}

init();
