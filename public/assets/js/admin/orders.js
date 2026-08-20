import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;
let statusFilter = '';

const root = document.querySelector('[data-orders-root]');

const STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  refunded: 'Đã hoàn tiền',
};

const STATUS_BADGE_CLASS = {
  pending: 'badge--warning',
  confirmed: 'badge--warning',
  processing: 'badge--warning',
  shipping: 'badge--warning',
  completed: 'badge--success',
  cancelled: 'badge--danger',
  refunded: 'badge--danger',
};

// Mirrors server/src/routes/admin/orders.js's ALLOWED_TRANSITIONS - kept in
// sync manually. Only used here to build a sensible dropdown; the server
// re-validates authoritatively regardless.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

function statusBadge(status) {
  return `<span class="badge ${STATUS_BADGE_CLASS[status] || 'badge--warning'}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Đơn hàng</h1>
      <select class="select" data-status-filter>
        <option value="">Tất cả trạng thái</option>
        ${Object.entries(STATUS_LABELS)
          .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
          .join('')}
      </select>
    </div>
    <div data-table></div>
    <div class="pagination" data-pagination></div>`;

  root.querySelector('[data-status-filter]').addEventListener('change', (event) => {
    statusFilter = event.target.value;
    currentPage = 1;
    loadList();
  });

  await loadList();
}

async function loadList() {
  const tableEl = root.querySelector('[data-table]');
  tableEl.innerHTML = '<div class="skeleton" style="height:240px;border-radius:16px"></div>';

  try {
    const query = new URLSearchParams({ page: currentPage, limit: 20 });
    if (statusFilter) query.set('status', statusFilter);
    const { data: orders, pagination } = await api.get(`/api/admin/orders?${query}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: orders,
      getRowId: (o) => o.id,
      emptyMessage: 'Chưa có đơn hàng nào.',
      columns: [
        { key: 'order_number', label: 'Mã đơn' },
        { label: 'Khách hàng', render: (o) => escapeHtml(o.guest_name || (o.user_id ? 'Thành viên' : 'Khách')) },
        { label: 'Trạng thái', render: (o) => statusBadge(o.status) },
        { label: 'Tổng tiền', render: (o) => formatCurrency(o.total_amount) },
        { label: 'Ngày đặt', render: (o) => formatDate(o.created_at) },
      ],
      rowActions: (o) => `<a class="btn btn--outline" href="./orders.html?id=${o.id}">Xem</a>`,
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được đơn hàng</p></div>`;
  }
}

async function renderDetail(orderId) {
  root.innerHTML = '<div class="skeleton" style="height:400px;border-radius:16px"></div>';

  let order;
  let shippingMethods = [];
  let paymentMethods = [];
  try {
    [order, shippingMethods, paymentMethods] = await Promise.all([
      api.get(`/api/admin/orders/${orderId}`, { token }),
      api.get('/api/checkout/shipping-methods'),
      api.get('/api/checkout/payment-methods'),
    ]);
  } catch {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tìm thấy đơn hàng</p>
        <a class="btn btn--primary" href="./orders.html">Quay lại danh sách</a>
      </div>`;
    return;
  }

  const nextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
  const address = order.shipping_address || {};
  const addressLine = [address.address_line, address.ward, address.district, address.province].filter(Boolean).join(', ');

  root.innerHTML = `
    <a class="admin-back-link" href="./orders.html">&larr; Quay lại danh sách đơn hàng</a>
    <div class="admin-form-panel">
      <div class="admin-toolbar">
        <h1 class="page-title">Đơn hàng #${escapeHtml(order.order_number)}</h1>
        ${statusBadge(order.status)}
      </div>

      <p><strong>Khách hàng:</strong> ${escapeHtml(order.guest_name || 'Thành viên')} ${order.guest_phone ? `- ${escapeHtml(order.guest_phone)}` : ''}</p>
      ${order.guest_email ? `<p><strong>Email:</strong> ${escapeHtml(order.guest_email)}</p>` : ''}
      <p><strong>Địa chỉ giao hàng:</strong> ${escapeHtml(addressLine)}</p>
      ${order.note || address.note ? `<p><strong>Ghi chú:</strong> ${escapeHtml(order.note || address.note)}</p>` : ''}

      <h2 class="admin-form-panel__heading">Sản phẩm</h2>
      <ul class="checkout-summary__items">
        ${order.order_items
          .map(
            (item) => `
          <li>
            <span>${escapeHtml(item.product_name)}${item.variant_name ? ` (${escapeHtml(item.variant_name)})` : ''} × ${item.quantity}</span>
            <span>${formatCurrency(item.line_total)}</span>
          </li>`,
          )
          .join('')}
      </ul>
      <div class="summary-rows">
        <div class="summary-row"><span>Tạm tính</span><span>${formatCurrency(order.subtotal)}</span></div>
        ${order.discount_amount > 0 ? `<div class="summary-row"><span>Giảm giá</span><span>-${formatCurrency(order.discount_amount)}</span></div>` : ''}
        <div class="summary-row"><span>Phí vận chuyển</span><span>${order.shipping_method_id ? formatCurrency(order.shipping_fee) : 'Chưa xác định'}</span></div>
        <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(order.total_amount)}</span></div>
      </div>

      <h2 class="admin-form-panel__heading">Vận chuyển &amp; thanh toán</h2>
      <p class="admin-form-panel__hint">Khách chưa chọn khi đặt hàng - gọi điện xác nhận với khách rồi điền vào đây.</p>
      <div class="alert alert--danger" data-fulfillment-error hidden></div>
      <form data-fulfillment-form>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="fulfillment-shipping">Phương thức vận chuyển</label>
            <select class="select" id="fulfillment-shipping" name="shippingMethodId">
              <option value="">-- Chưa xác định --</option>
              ${shippingMethods
                .map(
                  (m) =>
                    `<option value="${m.id}" ${order.shipping_method_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)} (${formatCurrency(m.fee)})</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="fulfillment-payment">Phương thức thanh toán</label>
            <select class="select" id="fulfillment-payment" name="paymentMethodId">
              <option value="">-- Chưa xác định --</option>
              ${paymentMethods
                .map((m) => `<option value="${m.id}" ${order.payment_method_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn--outline">Lưu vận chuyển &amp; thanh toán</button>
      </form>

      <h2 class="admin-form-panel__heading">Lịch sử trạng thái</h2>
      <ul class="order-status-history">
        ${order.order_status_history
          .map(
            (entry) => `
          <li>
            <span>${statusBadge(entry.status)}</span>
            <span>${formatDate(entry.created_at)}</span>
            ${entry.note ? `<span class="order-status-history__note">${escapeHtml(entry.note)}</span>` : ''}
          </li>`,
          )
          .join('')}
      </ul>

      ${
        nextStatuses.length
          ? `
      <h2 class="admin-form-panel__heading">Cập nhật trạng thái</h2>
      <div class="alert alert--danger" data-status-form-error hidden></div>
      <form data-status-form>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="next-status">Trạng thái mới</label>
            <select class="select" id="next-status" name="status">
              ${nextStatuses.map((s) => `<option value="${s}">${escapeHtml(STATUS_LABELS[s])}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="status-note">Ghi chú (không bắt buộc)</label>
            <input class="input" id="status-note" name="note" />
          </div>
        </div>
        <button type="submit" class="btn btn--primary">Cập nhật trạng thái</button>
      </form>`
          : '<p class="empty-state__title">Đơn hàng đã ở trạng thái cuối, không thể cập nhật thêm.</p>'
      }
    </div>`;

  root.querySelector('[data-fulfillment-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formError = root.querySelector('[data-fulfillment-error]');
    formError.hidden = true;
    const formData = new FormData(event.target);
    const shippingMethodId = formData.get('shippingMethodId') ? Number(formData.get('shippingMethodId')) : null;
    const paymentMethodId = formData.get('paymentMethodId') ? Number(formData.get('paymentMethodId')) : null;

    try {
      await api.patch(`/api/admin/orders/${orderId}/fulfillment`, { shippingMethodId, paymentMethodId }, { token });
      await renderDetail(orderId);
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không cập nhật được vận chuyển/thanh toán.';
    }
  });

  root.querySelector('[data-status-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formError = root.querySelector('[data-status-form-error]');
    formError.hidden = true;
    const formData = new FormData(event.target);

    try {
      await api.patch(
        `/api/admin/orders/${orderId}/status`,
        { status: formData.get('status'), note: formData.get('note').trim() || undefined },
        { token },
      );
      await renderDetail(orderId);
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không cập nhật được trạng thái.';
    }
  });
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  const orderId = new URLSearchParams(window.location.search).get('id');
  if (orderId) {
    await renderDetail(orderId);
  } else {
    await renderList();
  }
}

init();
