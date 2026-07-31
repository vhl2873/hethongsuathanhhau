import { requireAdminSession } from './admin-auth.js';
import { api } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import { renderTable } from './table.js';

const statsRoot = document.querySelector('[data-dashboard-stats]');
const ordersRoot = document.querySelector('[data-dashboard-orders]');

async function init() {
  const session = await requireAdminSession();
  if (!session) return;

  try {
    const summary = await api.get('/api/admin/dashboard/summary', { token: session.token });
    renderStats(summary);
    renderRecentOrders(summary.recent_orders);
  } catch {
    statsRoot.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được số liệu tổng quan</p></div>`;
  }
}

const ICONS = {
  box: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7 12 3 4 7v10l8 4 8-4V7Z"></path><path d="M4 7l8 4 8-4M12 11v10"></path></svg>',
  receipt:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2 5 5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5l-1-3"></path><path d="M9 11h6M9 15h6"></path></svg>',
  clock:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>',
  users:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c1.2-3.6 3.8-5.5 6.5-5.5s5.3 1.9 6.5 5.5"></path><circle cx="17.5" cy="8.5" r="2.5"></circle><path d="M15.5 14.5c2.2.3 4 1.9 4.9 4.5"></path></svg>',
  star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 2 2.9 6.3 6.6.7-5 4.6 1.4 6.7L12 16.9 6.1 20.3l1.4-6.7-5-4.6 6.6-.7z"></path></svg>',
};

function renderStats(summary) {
  const stats = [
    { label: 'Tổng sản phẩm', value: summary.product_count, icon: 'box' },
    { label: 'Tổng đơn hàng', value: summary.order_count, icon: 'receipt' },
    { label: 'Đơn chờ xác nhận', value: summary.pending_order_count, icon: 'clock', warning: true },
    { label: 'Khách hàng', value: summary.customer_count, icon: 'users' },
    { label: 'Đánh giá chờ duyệt', value: summary.pending_review_count, icon: 'star', warning: true },
  ];
  statsRoot.innerHTML = stats
    .map(
      (stat) => `
    <div class="admin-stat-card${stat.warning ? ' admin-stat-card--warning' : ''}">
      <span class="admin-stat-card__icon">${ICONS[stat.icon]}</span>
      <p class="admin-stat-card__value">${stat.value}</p>
      <p class="admin-stat-card__label">${stat.label}</p>
    </div>`,
    )
    .join('');
}

function renderRecentOrders(orders) {
  renderTable({
    container: ordersRoot,
    rows: orders,
    getRowId: (order) => order.id,
    emptyMessage: 'Chưa có đơn hàng nào.',
    columns: [
      { key: 'order_number', label: 'Mã đơn' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'total_amount', label: 'Tổng tiền', render: (order) => formatCurrency(order.total_amount) },
      { key: 'created_at', label: 'Ngày đặt', render: (order) => new Date(order.created_at).toLocaleDateString('vi-VN') },
    ],
    rowActions: (order) => `<a class="btn btn--outline" href="./orders.html?id=${order.id}">Xem</a>`,
  });
}

init();
