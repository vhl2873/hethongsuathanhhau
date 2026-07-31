import { requireAdminSession } from './admin-auth.js';
import { api } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;
let statusFilter = '';

const root = document.querySelector('[data-contacts-root]');

const STATUS_LABELS = { new: 'Mới', read: 'Đã xem', replied: 'Đã phản hồi' };
const STATUS_BADGE_CLASS = { new: 'badge--warning', read: 'badge--success', replied: 'badge--success' };

async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Liên hệ từ khách hàng</h1>
      <select class="select" data-status-filter>
        <option value="">Tất cả trạng thái</option>
        <option value="new">Mới</option>
        <option value="read">Đã xem</option>
        <option value="replied">Đã phản hồi</option>
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
    const query = new URLSearchParams({ page: currentPage });
    if (statusFilter) query.set('status', statusFilter);
    const { data: contacts, pagination } = await api.get(`/api/admin/contacts?${query}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: contacts,
      getRowId: (c) => c.id,
      emptyMessage: 'Chưa có liên hệ nào.',
      columns: [
        { label: 'Họ tên', render: (c) => escapeHtml(c.name) },
        { label: 'Email', render: (c) => escapeHtml(c.email) },
        { label: 'Chủ đề', render: (c) => escapeHtml(c.subject || '-') },
        { label: 'Nội dung', render: (c) => escapeHtml(c.message).slice(0, 100) },
        { label: 'Ngày gửi', render: (c) => new Date(c.created_at).toLocaleDateString('vi-VN') },
        {
          label: 'Trạng thái',
          render: (c) => `<span class="badge ${STATUS_BADGE_CLASS[c.status]}">${escapeHtml(STATUS_LABELS[c.status] || c.status)}</span>`,
        },
      ],
      rowActions: (c) => `
        <select class="select" data-status-select="${c.id}">
          ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${c.status === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>`,
    });

    tableEl.querySelectorAll('[data-status-select]').forEach((select) => {
      select.addEventListener('change', async () => {
        try {
          await api.patch(`/api/admin/contacts/${select.dataset.statusSelect}/status`, { status: select.value }, { token });
          await loadList();
        } catch {
          window.alert('Không cập nhật được trạng thái.');
        }
      });
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được liên hệ</p></div>`;
  }
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await renderList();
}

init();
