import * as cart from '../cart.js';
import { api, ApiError } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';
import { validateCheckoutForm } from '../lib/validators.js';
import { getSavedCouponCode, saveCouponCode, validateCoupon } from '../lib/coupon-state.js';

const root = document.querySelector('[data-checkout-root]');

let appliedCoupon = null;
let shippingMethods = [];
let paymentMethods = [];
let selectedShippingId = null;
let selectedPaymentId = null;

function getSubtotal() {
  return cart.getTotal();
}
function getDiscount() {
  return appliedCoupon?.discount_amount || 0;
}
function getShippingFee() {
  const method = shippingMethods.find((m) => m.id === selectedShippingId);
  return Number(method?.fee) || 0;
}
function getTotal() {
  return getSubtotal() - getDiscount() + getShippingFee();
}

async function init() {
  const items = cart.getItems();
  if (!items.length) {
    root.innerHTML = `
      <div class="panel empty-state">
        <p class="empty-state__title">Giỏ hàng đang trống</p>
        <p>Vui lòng thêm sản phẩm trước khi thanh toán.</p>
        <p><a class="btn btn--primary" href="./shop.html">Quay lại cửa hàng</a></p>
      </div>`;
    return;
  }

  // Delivery and payment options are the store's own rows; if either list is
  // empty the matching step is left out and the order goes through as a
  // request the shop confirms by phone, exactly as before.
  const [shipping, payment] = await Promise.all([
    api.get('/api/checkout/shipping-methods').catch(() => []),
    api.get('/api/checkout/payment-methods').catch(() => []),
  ]);
  shippingMethods = shipping;
  paymentMethods = payment;
  selectedShippingId = shippingMethods[0]?.id ?? null;
  selectedPaymentId = paymentMethods[0]?.id ?? null;

  renderForm(items);
  restoreSavedCoupon();
}

function optionCard({ name, value, label, description, fee, checked }) {
  return `
    <label class="option-card">
      <input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} />
      <span class="option-card__body">
        <span class="option-card__name">${escapeHtml(label)}</span>
        ${description ? `<span class="option-card__desc">${escapeHtml(description)}</span>` : ''}
      </span>
      ${fee === undefined ? '' : `<span class="option-card__fee">${Number(fee) > 0 ? formatCurrency(fee) : 'Miễn phí'}</span>`}
    </label>`;
}

function renderForm(items) {
  const stepNumbers = { shipping: shippingMethods.length ? 2 : null };
  const paymentStep = shippingMethods.length ? 3 : 2;

  root.innerHTML = `
    <div class="checkout-head">
      <h1 class="checkout-head__title">Thanh toán</h1>
      <div class="flow-steps">
        <a class="flow-steps__step is-done" data-step="1" href="./cart.html">Giỏ hàng</a>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step is-current" data-step="2">Thanh toán</span>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step" data-step="3">Hoàn tất</span>
      </div>
    </div>

    <form class="checkout-layout" data-checkout-form novalidate>
      <div class="panel-stack">
        <section class="panel">
          <h2 class="step-head"><span class="step-head__num">1</span>Thông tin nhận hàng</h2>
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="guestName">Họ và tên *</label>
              <input class="input" type="text" id="guestName" name="guestName" autocomplete="name" required />
              <span class="field__error" data-error="guestName"></span>
            </div>
            <div class="field">
              <label class="field__label" for="guestPhone">Số điện thoại *</label>
              <input class="input" type="tel" id="guestPhone" name="guestPhone" autocomplete="tel" required />
              <span class="field__error" data-error="guestPhone"></span>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="guestEmail">Email (không bắt buộc)</label>
            <input class="input" type="email" id="guestEmail" name="guestEmail" autocomplete="email" />
            <span class="field__error" data-error="guestEmail"></span>
          </div>
          <div class="field">
            <label class="field__label" for="addressLine">Địa chỉ *</label>
            <input class="input" type="text" id="addressLine" name="addressLine" autocomplete="street-address"
              placeholder="Số nhà, tên đường" required />
            <span class="field__error" data-error="addressLine"></span>
          </div>
          <div class="field-row--3 field-row">
            <div class="field">
              <label class="field__label" for="province">Tỉnh / Thành *</label>
              <input class="input" type="text" id="province" name="province" required />
              <span class="field__error" data-error="province"></span>
            </div>
            <div class="field">
              <label class="field__label" for="district">Quận / Huyện</label>
              <input class="input" type="text" id="district" name="district" />
            </div>
            <div class="field">
              <label class="field__label" for="ward">Phường / Xã</label>
              <input class="input" type="text" id="ward" name="ward" />
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="note">Ghi chú cho người giao (không bắt buộc)</label>
            <textarea class="textarea" id="note" name="note"
              placeholder="Ví dụ: gọi trước khi tới, giao giờ hành chính…"></textarea>
          </div>
        </section>

        ${shippingMethods.length
          ? `<section class="panel">
              <h2 class="step-head"><span class="step-head__num">${stepNumbers.shipping}</span>Phương thức giao hàng</h2>
              <div class="option-list">
                ${shippingMethods
                  .map((method, i) =>
                    optionCard({
                      name: 'shippingMethodId',
                      value: method.id,
                      label: method.name,
                      description: method.description,
                      fee: method.fee,
                      checked: i === 0,
                    }),
                  )
                  .join('')}
              </div>
            </section>`
          : ''}

        ${paymentMethods.length
          ? `<section class="panel">
              <h2 class="step-head"><span class="step-head__num">${paymentStep}</span>Phương thức thanh toán</h2>
              <div class="option-list">
                ${paymentMethods
                  .map((method, i) =>
                    optionCard({
                      name: 'paymentMethodId',
                      value: method.id,
                      label: method.name,
                      description: method.description,
                      checked: i === 0,
                    }),
                  )
                  .join('')}
              </div>
            </section>`
          : ''}

        ${!shippingMethods.length || !paymentMethods.length
          ? `<div class="alert alert--info">
              Nhân viên cửa hàng sẽ gọi điện xác nhận đơn hàng, phí vận chuyển và phương thức thanh toán phù hợp với bạn.
            </div>`
          : ''}
      </div>

      <aside class="checkout-summary">
        <div class="panel">
          <div class="section-head">
            <h2 class="section-head__title">Đơn hàng</h2>
            <a class="section-head__more" href="./cart.html">Sửa &rarr;</a>
          </div>
          <div class="checkout-summary__items">
            ${items
              .map(
                (item) => `
              <div class="checkout-summary__item">
                <span class="checkout-summary__item-name">${escapeHtml(item.productName)}
                  <span class="checkout-summary__item-qty">${item.variantName ? `${escapeHtml(item.variantName)} · ` : ''}SL ${item.quantity}</span>
                </span>
                <span class="checkout-summary__item-total">${formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>`,
              )
              .join('')}
          </div>

          <div class="checkout-coupon">
            <label class="sr-only" for="checkout-coupon-input">Mã giảm giá</label>
            <input class="input" id="checkout-coupon-input" type="text" placeholder="Mã giảm giá" autocomplete="off" data-coupon-input />
            <button type="button" class="btn btn--outline btn--sm" data-coupon-apply>Áp dụng</button>
          </div>
          <p class="checkout-coupon__message" data-coupon-message role="status"></p>

          <div class="summary-rows">
            <div class="summary-row"><span>Tạm tính</span><span data-subtotal>${formatCurrency(getSubtotal())}</span></div>
            <div class="summary-row summary-row--discount" data-discount-row hidden><span data-discount-label>Giảm giá</span><span data-discount>-0</span></div>
            <div class="summary-row" data-shipping-row ${shippingMethods.length ? '' : 'hidden'}>
              <span>Phí giao hàng</span><span data-shipping-fee>${formatCurrency(getShippingFee())}</span>
            </div>
            ${!shippingMethods.length
              ? '<div class="summary-row summary-row--muted"><span>Phí giao hàng</span><span>Xác nhận qua điện thoại</span></div>'
              : ''}
            <div class="summary-row summary-row--total"><span>Cần thanh toán</span><span data-total>${formatCurrency(getTotal())}</span></div>
          </div>

          <div class="alert alert--danger" data-submit-error hidden></div>
          <p><button type="submit" class="btn btn--primary btn--block" data-submit>Đặt hàng</button></p>
          <p class="checkout-terms">Bằng việc đặt hàng, bạn đồng ý với điều khoản mua bán của Thanh Hậu. Đơn hàng được
            cửa hàng xác nhận trước khi giao.</p>
        </div>

        <div class="panel">
          <div class="section-head"><h2 class="section-head__title">Khi nhận hàng, bạn được</h2></div>
          <ul class="assurance-list">
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16v12H4z"></path><path d="M4 11h16"></path></svg>
              Mở hộp kiểm tra sản phẩm trước khi thanh toán.
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6l7-3z"></path><path d="M9.2 12l2 2 3.6-4"></path></svg>
              Kiểm tra tem chống hàng giả cùng nhân viên giao hàng.
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 1 14.5 4.6"></path><path d="M4 6v6h6"></path></svg>
              Đổi ngay nếu hộp móp do vận chuyển hoặc giao sai loại.
            </li>
          </ul>
        </div>
      </aside>
    </form>`;

  wireForm(items);
}

function wireForm(items) {
  const form = root.querySelector('[data-checkout-form]');

  form.querySelectorAll('input[name="shippingMethodId"]').forEach((input) => {
    input.addEventListener('change', () => {
      selectedShippingId = Number(input.value);
      updateTotals();
    });
  });
  form.querySelectorAll('input[name="paymentMethodId"]').forEach((input) => {
    input.addEventListener('change', () => {
      selectedPaymentId = Number(input.value);
    });
  });

  root.querySelector('[data-coupon-apply]').addEventListener('click', async () => {
    const input = root.querySelector('[data-coupon-input]');
    const messageEl = root.querySelector('[data-coupon-message]');
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    messageEl.classList.remove('is-error');
    messageEl.textContent = 'Đang kiểm tra mã…';

    try {
      const result = await api.post('/api/checkout/validate-coupon', { code, subtotal: getSubtotal() });
      appliedCoupon = result;
      saveCouponCode(result.code);
      messageEl.textContent = `Đã áp dụng mã ${result.code}.`;
    } catch (err) {
      appliedCoupon = null;
      saveCouponCode('');
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

// Carries over a code the shopper already checked on the cart page.
async function restoreSavedCoupon() {
  const code = getSavedCouponCode();
  if (!code) return;
  const input = root.querySelector('[data-coupon-input]');
  if (input) input.value = code;

  const result = await validateCoupon(code, getSubtotal());
  const messageEl = root.querySelector('[data-coupon-message]');
  if (result) {
    appliedCoupon = result;
    if (messageEl) messageEl.textContent = `Đã áp dụng mã ${result.code}.`;
    updateTotals();
  } else {
    saveCouponCode('');
  }
}

function updateTotals() {
  root.querySelector('[data-subtotal]').textContent = formatCurrency(getSubtotal());
  root.querySelector('[data-total]').textContent = formatCurrency(getTotal());

  const shippingFeeEl = root.querySelector('[data-shipping-fee]');
  if (shippingFeeEl) {
    shippingFeeEl.textContent = getShippingFee() > 0 ? formatCurrency(getShippingFee()) : 'Miễn phí';
  }

  const discountRow = root.querySelector('[data-discount-row]');
  if (getDiscount() > 0) {
    discountRow.hidden = false;
    root.querySelector('[data-discount-label]').textContent = `Mã ${appliedCoupon.code}`;
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
  submitBtn.textContent = 'Đang gửi…';
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
        // The order RPC has no note parameter, so the delivery note travels
        // with the address JSON instead of being silently dropped.
        note: values.note || undefined,
      },
      shippingMethodId: selectedShippingId ?? undefined,
      paymentMethodId: selectedPaymentId ?? undefined,
      couponCode: appliedCoupon?.code,
      items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    });

    cart.clearCart();
    saveCouponCode('');
    renderConfirmation(result);
  } catch (err) {
    const errorEl = root.querySelector('[data-submit-error]');
    errorEl.hidden = false;
    errorEl.textContent = err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đặt hàng';
  }
}

function renderConfirmation(result) {
  root.innerHTML = `
    <div class="panel checkout-confirmation">
      <div class="flow-steps" style="justify-content:center">
        <span class="flow-steps__step is-done" data-step="1">Giỏ hàng</span>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step is-done" data-step="2">Thanh toán</span>
        <span class="flow-steps__sep" aria-hidden="true"></span>
        <span class="flow-steps__step is-current" data-step="3">Hoàn tất</span>
      </div>
      <p class="checkout-confirmation__badge">Chờ xác nhận</p>
      <h1 class="checkout-confirmation__title">Đã gửi yêu cầu đặt hàng</h1>
      <p>Mã đơn hàng của bạn: <strong>${escapeHtml(result.order_number)}</strong></p>
      <div class="summary-rows">
        <div class="summary-row"><span>Tạm tính</span><span>${formatCurrency(result.subtotal)}</span></div>
        ${result.discount_amount > 0 ? `<div class="summary-row summary-row--discount"><span>Giảm giá</span><span>-${formatCurrency(result.discount_amount)}</span></div>` : ''}
        ${Number(result.shipping_fee) > 0 ? `<div class="summary-row"><span>Phí giao hàng</span><span>${formatCurrency(result.shipping_fee)}</span></div>` : ''}
        <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(result.total_amount)}</span></div>
      </div>
      <p class="checkout-confirmation__note">Đơn hàng đang <strong>chờ cửa hàng xác nhận</strong>. Nhân viên sẽ gọi điện
        trong thời gian sớm nhất để xác nhận sản phẩm và thời gian giao.</p>
      <p>
        <a class="btn btn--primary" href="./account-orders.html">Theo dõi đơn hàng</a>
        <a class="btn btn--outline" href="./shop.html">Tiếp tục mua sắm</a>
      </p>
    </div>`;
}

init();
