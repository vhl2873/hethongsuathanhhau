import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;
let roleFilter = '';

const root = document.querySelector('[data-customers-root]');

const ROLE_LABELS = { customer: 'Khách hàng', staff: 'Nhân viên', admin: 'Quản trị viên' };

function roleBadge(role) {
  const cls = role === 'admin' ? 'badge--danger' : role === 'staff' ? 'badge--warning' : 'badge--success';
  return `<span class="badge ${cls}">${escapeHtml(ROLE_LABELS[role] || role)}</span>`;
}

async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Khách hàng</h1>
      <select class="select" data-role-filter>
        <option value="">Tất cả vai trò</option>
        <option value="customer">Khách hàng</option>
        <option value="staff">Nhân viên</option>
        <option value="admin">Quản trị viên</option>
      </select>
    </div>
    <div data-table></div>
    <div class="pagination" data-pagination></div>`;

  root.querySelector('[data-role-filter]').addEventListener('change', (event) => {
    roleFilter = event.target.value;
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
    if (roleFilter) query.set('role', roleFilter);
    const { data: customers, pagination } = await api.get(`/api/admin/customers?${query}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: customers,
      getRowId: (c) => c.id,
      emptyMessage: 'Chưa có khách hàng nào.',
      columns: [
        { label: 'Họ tên', render: (c) => escapeHtml(c.full_name || '(chưa cập nhật)') },
        { label: 'Email', render: (c) => escapeHtml(c.email || '-') },
        { label: 'Số điện thoại', render: (c) => escapeHtml(c.phone || '-') },
        { label: 'Vai trò', render: (c) => roleBadge(c.role) },
        { label: 'Ngày tham gia', render: (c) => new Date(c.created_at).toLocaleDateString('vi-VN') },
      ],
      rowActions: (c) => `
        <select class="select" data-role-select="${c.id}">
          ${['customer', 'staff', 'admin']
            .map((r) => `<option value="${r}" ${c.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`)
            .join('')}
        </select>`,
    });

    tableEl.querySelectorAll('[data-role-select]').forEach((select) => {
      const originalValue = select.value;
      select.addEventListener('change', async () => {
        const id = select.dataset.roleSelect;
        const newRole = select.value;
        const confirmed = await confirmDialog({
          title: 'Đổi vai trò',
          message: `Đổi vai trò của khách hàng này thành "${ROLE_LABELS[newRole]}"?`,
          danger: newRole === 'admin',
        });
        if (!confirmed) {
          select.value = originalValue;
          return;
        }
        try {
          await api.patch(`/api/admin/customers/${id}`, { role: newRole }, { token });
          await loadList();
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : 'Không đổi được vai trò.');
          select.value = originalValue;
        }
      });
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được danh sách khách hàng</p></div>`;
  }
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await renderList();
}

init();
