import { requireAdminSession } from './admin-auth.js';
import { api } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;
let statusFilter = 'pending';

const root = document.querySelector('[data-reviews-root]');

function stars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Đánh giá sản phẩm</h1>
      <select class="select" data-status-filter>
        <option value="pending">Chờ duyệt</option>
        <option value="approved">Đã duyệt</option>
        <option value="">Tất cả</option>
      </select>
    </div>
    <div data-table></div>
    <div class="pagination" data-pagination></div>`;

  root.querySelector('[data-status-filter]').value = statusFilter;
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
    const { data: reviews, pagination } = await api.get(`/api/admin/reviews?${query}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: reviews,
      getRowId: (r) => r.id,
      emptyMessage: 'Không có đánh giá nào.',
      columns: [
        { label: 'Sản phẩm', render: (r) => escapeHtml(r.product?.name || '-') },
        { label: 'Số sao', render: (r) => `<span style="color:var(--color-accent)">${stars(r.rating)}</span>` },
        { label: 'Nội dung', render: (r) => escapeHtml((r.title ? `${r.title}: ` : '') + (r.content || '')).slice(0, 120) },
        { label: 'Ngày gửi', render: (r) => new Date(r.created_at).toLocaleDateString('vi-VN') },
        {
          label: 'Trạng thái',
          render: (r) => (r.is_approved ? '<span class="badge badge--success">Đã duyệt</span>' : '<span class="badge badge--warning">Chờ duyệt</span>'),
        },
      ],
      rowActions: (r) => `
        ${!r.is_approved ? `<button type="button" class="btn btn--primary" data-approve="${r.id}">Duyệt</button>` : ''}
        <button type="button" class="btn btn--danger" data-delete="${r.id}">Xoá</button>`,
    });

    tableEl.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/api/admin/reviews/${btn.dataset.approve}/approve`, {}, { token });
          await loadList();
        } catch {
          window.alert('Không duyệt được đánh giá.');
        }
      });
    });
    tableEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({ title: 'Xoá đánh giá', message: 'Xoá đánh giá này khỏi hệ thống?' });
        if (!confirmed) return;
        try {
          await api.delete(`/api/admin/reviews/${btn.dataset.delete}`, { token });
          await loadList();
        } catch {
          window.alert('Không xoá được đánh giá.');
        }
      });
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được đánh giá</p></div>`;
  }
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await renderList();
}

init();
