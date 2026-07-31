import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

let token = null;
let coupons = [];

const tableRoot = document.querySelector('[data-coupons-table]');
const formPanel = document.querySelector('[data-coupon-form-panel]');
const form = document.querySelector('[data-coupon-form]');
const formError = document.querySelector('[data-coupon-form-error]');
const formHeading = document.querySelector('[data-coupon-form-heading]');

function discountLabel(coupon) {
  return coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value);
}

function render() {
  renderTable({
    container: tableRoot,
    rows: coupons,
    getRowId: (c) => c.id,
    emptyMessage: 'Chưa có mã giảm giá nào.',
    columns: [
      { key: 'code', label: 'Mã' },
      { label: 'Giảm giá', render: discountLabel },
      { label: 'Đơn tối thiểu', render: (c) => formatCurrency(c.min_order_amount) },
      { label: 'Đã dùng', render: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ''}` },
      {
        label: 'Trạng thái',
        render: (c) => (c.is_active ? '<span class="badge badge--success">Hoạt động</span>' : '<span class="badge badge--danger">Tắt</span>'),
      },
    ],
    rowActions: (c) => `
      <button type="button" class="btn btn--outline" data-edit="${c.id}">Sửa</button>
      <button type="button" class="btn btn--danger" data-delete="${c.id}">Xoá</button>`,
  });

  tableRoot.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => showForm(coupons.find((c) => c.id === Number(btn.dataset.edit))));
  });
  tableRoot.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(Number(btn.dataset.delete)));
  });
}

function showForm(coupon) {
  formPanel.hidden = false;
  formError.hidden = true;
  formHeading.textContent = coupon ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá mới';
  form.elements.couponId.value = coupon?.id || '';
  form.elements.code.value = coupon?.code || '';
  form.elements.description.value = coupon?.description || '';
  form.elements.discount_type.value = coupon?.discount_type || 'percentage';
  form.elements.discount_value.value = coupon?.discount_value ?? '';
  form.elements.min_order_amount.value = coupon?.min_order_amount ?? 0;
  form.elements.max_discount_amount.value = coupon?.max_discount_amount ?? '';
  form.elements.usage_limit.value = coupon?.usage_limit ?? '';
  form.elements.is_active.checked = coupon ? coupon.is_active : true;
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function loadCoupons() {
  tableRoot.innerHTML = '<div class="skeleton" style="height:200px;border-radius:16px"></div>';
  try {
    coupons = await api.get('/api/admin/coupons', { token });
    render();
  } catch {
    tableRoot.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được mã giảm giá</p></div>`;
  }
}

async function handleDelete(id) {
  const coupon = coupons.find((c) => c.id === id);
  const confirmed = await confirmDialog({ title: 'Xoá mã giảm giá', message: `Xoá mã "${coupon?.code}"?` });
  if (!confirmed) return;
  try {
    await api.delete(`/api/admin/coupons/${id}`, { token });
    await loadCoupons();
  } catch {
    window.alert('Không xoá được mã giảm giá.');
  }
}

document.querySelector('[data-add-coupon]').addEventListener('click', () => showForm(null));
document.querySelector('[data-cancel-coupon]').addEventListener('click', () => {
  formPanel.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;
  const formData = new FormData(form);
  const payload = {
    code: formData.get('code').trim(),
    description: formData.get('description').trim(),
    discount_type: formData.get('discount_type'),
    discount_value: Number(formData.get('discount_value')),
    min_order_amount: Number(formData.get('min_order_amount')) || 0,
    max_discount_amount: formData.get('max_discount_amount') ? Number(formData.get('max_discount_amount')) : null,
    usage_limit: formData.get('usage_limit') ? Number(formData.get('usage_limit')) : null,
    is_active: formData.get('is_active') === 'on',
  };
  const couponId = formData.get('couponId');

  try {
    if (couponId) {
      await api.put(`/api/admin/coupons/${couponId}`, payload, { token });
    } else {
      await api.post('/api/admin/coupons', payload, { token });
    }
    formPanel.hidden = true;
    await loadCoupons();
  } catch (err) {
    formError.hidden = false;
    formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được mã giảm giá.';
  }
});

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await loadCoupons();
}

init();
