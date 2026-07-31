import { requireAdminSession } from './admin-auth.js';
import { api } from '../lib/api.js';
import { renderTable } from './table.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let subscribers = [];

const root = document.querySelector('[data-newsletter-root]');

function downloadCsv() {
  const header = 'email,is_active,subscribed_at';
  const rows = subscribers.map((s) => `${s.email},${s.is_active},${s.subscribed_at}`);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  const tableEl = root.querySelector('[data-table]');
  renderTable({
    container: tableEl,
    rows: subscribers,
    getRowId: (s) => s.id,
    emptyMessage: 'Chưa có ai đăng ký nhận tin.',
    columns: [
      { label: 'Email', render: (s) => escapeHtml(s.email) },
      {
        label: 'Trạng thái',
        render: (s) => (s.is_active ? '<span class="badge badge--success">Đang nhận tin</span>' : '<span class="badge badge--danger">Đã huỷ</span>'),
      },
      { label: 'Ngày đăng ký', render: (s) => new Date(s.subscribed_at).toLocaleDateString('vi-VN') },
    ],
  });
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Đăng ký nhận tin</h1>
      <button type="button" class="btn btn--outline" data-export>Xuất CSV</button>
    </div>
    <div data-table><div class="skeleton" style="height:240px;border-radius:16px"></div></div>`;

  root.querySelector('[data-export]').addEventListener('click', downloadCsv);

  try {
    subscribers = await api.get('/api/admin/newsletter', { token });
    render();
  } catch {
    root.querySelector('[data-table]').innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được danh sách</p></div>`;
  }
}

init();
