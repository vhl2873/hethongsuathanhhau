import { getSession } from '../auth.js';
import { api } from '../lib/api.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-orders-root]');
let token = null;

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

function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || 'badge--warning';
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function init() {
  const session = await getSession();
  if (!session) {
    window.location.href = './login.html?redirect=' + encodeURIComponent('./account-orders.html');
    return;
  }
  token = session.access_token;

  const orderNumber = new URLSearchParams(window.location.search).get('order');
  if (orderNumber) {
    await renderDetail(orderNumber);
  } else {
    await renderList();
  }
}

async function renderList() {
  root.innerHTML = '<div class="skeleton" style="height:240px;border-radius:16px"></div>';

  try {
    const { data: orders } = await api.get('/api/orders', { token, raw: true });

    if (!orders.length) {
      root.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Bạn chưa có đơn hàng nào</p>
          <p>Các đơn hàng bạn đặt sẽ hiển thị tại đây.</p>
          <a class="btn btn--primary" href="./shop.html">Mua sắm ngay</a>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="order-list">
        ${orders
          .map(
            (order) => `
          <a class="card order-row" href="./account-orders.html?order=${encodeURIComponent(order.order_number)}">
            <div>
              <p class="order-row__number">#${escapeHtml(order.order_number)}</p>
              <p class="order-row__date">${formatDate(order.created_at)}</p>
            </div>
            ${statusBadge(order.status)}
            <p class="order-row__total">${formatCurrency(order.total_amount)}</p>
          </a>`,
          )
          .join('')}
      </div>`;
  } catch {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được đơn hàng</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

async function renderDetail(orderNumber) {
  root.innerHTML = '<div class="skeleton" style="height:240px;border-radius:16px"></div>';

  try {
    const order = await api.get(`/api/orders/${encodeURIComponent(orderNumber)}`, { token });

    root.innerHTML = `
      <a class="order-detail__back" href="./account-orders.html">&larr; Quay lại danh sách đơn hàng</a>
      <div class="card order-detail">
        <div class="order-detail__header">
          <h2>Đơn hàng #${escapeHtml(order.order_number)}</h2>
          ${statusBadge(order.status)}
        </div>
        <p class="order-detail__date">Đặt ngày ${formatDate(order.created_at)}</p>

        <ul class="order-detail__items">
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

        <div class="order-detail__totals">
          <div class="summary-row"><span>Tạm tính</span><span>${formatCurrency(order.subtotal)}</span></div>
          ${order.discount_amount > 0 ? `<div class="summary-row"><span>Giảm giá</span><span>-${formatCurrency(order.discount_amount)}</span></div>` : ''}
          <div class="summary-row"><span>Phí vận chuyển</span><span>${formatCurrency(order.shipping_fee)}</span></div>
          <div class="summary-row summary-row--total"><span>Tổng cộng</span><span>${formatCurrency(order.total_amount)}</span></div>
        </div>

        <h3 class="order-detail__subheading">Lịch sử trạng thái</h3>
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
      </div>`;
  } catch {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tìm thấy đơn hàng</p>
        <a class="btn btn--primary" href="./account-orders.html">Quay lại danh sách</a>
      </div>`;
  }
}

init();
