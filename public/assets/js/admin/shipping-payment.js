import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

let token = null;

// Shipping methods and payment methods are nearly identical CRUD shapes
// (name/description/sort_order/is_active, shipping additionally has a fee)
// - one factory drives both sections instead of duplicating the wiring.
function createManager({ endpoint, hasFee, root, resourceLabel }) {
  let items = [];
  const tableEl = root.querySelector('[data-table]');
  const formPanel = root.querySelector('[data-form-panel]');
  const form = root.querySelector('[data-form]');
  const formError = root.querySelector('[data-form-error]');
  const formHeading = root.querySelector('[data-form-heading]');

  function render() {
    const columns = [
      { key: 'name', label: 'Tên' },
      { label: 'Mô tả', render: (i) => escapeHtml(i.description || '-') },
    ];
    if (hasFee) columns.push({ label: 'Phí', render: (i) => formatCurrency(i.fee) });
    columns.push({ key: 'sort_order', label: 'Thứ tự' });
    columns.push({
      label: 'Trạng thái',
      render: (i) => (i.is_active ? '<span class="badge badge--success">Hoạt động</span>' : '<span class="badge badge--danger">Tắt</span>'),
    });

    renderTable({
      container: tableEl,
      rows: items,
      getRowId: (i) => i.id,
      emptyMessage: `Chưa có ${resourceLabel} nào.`,
      columns,
      rowActions: (i) => `
        <button type="button" class="btn btn--outline" data-edit="${i.id}">Sửa</button>
        <button type="button" class="btn btn--danger" data-delete="${i.id}">Xoá</button>`,
    });

    tableEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => showForm(items.find((i) => i.id === Number(btn.dataset.edit))));
    });
    tableEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.delete)));
    });
  }

  function showForm(item) {
    formPanel.hidden = false;
    formError.hidden = true;
    formHeading.textContent = item ? `Sửa ${resourceLabel}` : `Thêm ${resourceLabel} mới`;
    form.elements.itemId.value = item?.id || '';
    form.elements.name.value = item?.name || '';
    form.elements.description.value = item?.description || '';
    if (hasFee) form.elements.fee.value = item?.fee ?? 0;
    form.elements.sort_order.value = item?.sort_order ?? 0;
    form.elements.is_active.checked = item ? item.is_active : true;
    formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function load() {
    tableEl.innerHTML = '<div class="skeleton" style="height:160px;border-radius:16px"></div>';
    try {
      items = await api.get(`/api/admin/${endpoint}`, { token });
      render();
    } catch {
      tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được dữ liệu</p></div>`;
    }
  }

  async function handleDelete(id) {
    const confirmed = await confirmDialog({ title: `Xoá ${resourceLabel}`, message: `Xoá ${resourceLabel} này?` });
    if (!confirmed) return;
    try {
      await api.delete(`/api/admin/${endpoint}/${id}`, { token });
      await load();
    } catch {
      window.alert('Không xoá được, vui lòng thử lại.');
    }
  }

  root.querySelector('[data-add]').addEventListener('click', () => showForm(null));
  root.querySelector('[data-cancel]').addEventListener('click', () => {
    formPanel.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      sort_order: Number(formData.get('sort_order')) || 0,
      is_active: formData.get('is_active') === 'on',
    };
    if (hasFee) payload.fee = Number(formData.get('fee')) || 0;
    const itemId = formData.get('itemId');

    try {
      if (itemId) {
        await api.put(`/api/admin/${endpoint}/${itemId}`, payload, { token });
      } else {
        await api.post(`/api/admin/${endpoint}`, payload, { token });
      }
      formPanel.hidden = true;
      await load();
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được, vui lòng thử lại.';
    }
  });

  return { load };
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  const shipping = createManager({
    endpoint: 'shipping-methods',
    hasFee: true,
    root: document.querySelector('[data-shipping-section]'),
    resourceLabel: 'phương thức vận chuyển',
  });
  const payment = createManager({
    endpoint: 'payment-methods',
    hasFee: false,
    root: document.querySelector('[data-payment-section]'),
    resourceLabel: 'phương thức thanh toán',
  });

  await Promise.all([shipping.load(), payment.load()]);
}

init();
