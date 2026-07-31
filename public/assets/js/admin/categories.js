import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let categories = [];

const tableRoot = document.querySelector('[data-categories-table]');
const formPanel = document.querySelector('[data-category-form-panel]');
const form = document.querySelector('[data-category-form]');
const formError = document.querySelector('[data-category-form-error]');
const formHeading = document.querySelector('[data-category-form-heading]');

function parentName(category) {
  if (!category.parent_id) return '-';
  return categories.find((c) => c.id === category.parent_id)?.name || '-';
}

function render() {
  renderTable({
    container: tableRoot,
    rows: categories,
    getRowId: (c) => c.id,
    emptyMessage: 'Chưa có danh mục nào.',
    columns: [
      { key: 'name', label: 'Tên danh mục' },
      { key: 'slug', label: 'Slug' },
      { label: 'Danh mục cha', render: parentName },
      { key: 'sort_order', label: 'Thứ tự' },
      {
        label: 'Trạng thái',
        render: (c) => (c.is_active ? '<span class="badge badge--success">Hiện</span>' : '<span class="badge badge--danger">Ẩn</span>'),
      },
    ],
    rowActions: (c) => `
      <button type="button" class="btn btn--outline" data-edit="${c.id}">Sửa</button>
      <button type="button" class="btn btn--danger" data-delete="${c.id}">Xoá</button>`,
  });

  tableRoot.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => showForm(categories.find((c) => c.id === Number(btn.dataset.edit))));
  });
  tableRoot.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(Number(btn.dataset.delete)));
  });
}

function showForm(category) {
  formPanel.hidden = false;
  formError.hidden = true;
  formHeading.textContent = category ? 'Sửa danh mục' : 'Thêm danh mục mới';
  form.elements.categoryId.value = category?.id || '';
  form.elements.name.value = category?.name || '';
  form.elements.slug.value = category?.slug || '';
  form.elements.description.value = category?.description || '';
  form.elements.image_url.value = category?.image_url || '';
  form.elements.parent_id.innerHTML =
    '<option value="">— Không có —</option>' +
    categories
      .filter((c) => c.id !== category?.id)
      .map((c) => `<option value="${c.id}" ${category?.parent_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
      .join('');
  form.elements.sort_order.value = category?.sort_order ?? 0;
  form.elements.is_active.checked = category ? category.is_active : true;
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function loadCategories() {
  tableRoot.innerHTML = '<div class="skeleton" style="height:200px;border-radius:16px"></div>';
  try {
    categories = await api.get('/api/admin/categories', { token });
    render();
  } catch {
    tableRoot.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được danh mục</p></div>`;
  }
}

async function handleDelete(id) {
  const category = categories.find((c) => c.id === id);
  const confirmed = await confirmDialog({
    title: 'Xoá danh mục',
    message: `Xoá danh mục "${category?.name}"? Sản phẩm thuộc danh mục này sẽ không còn danh mục.`,
  });
  if (!confirmed) return;

  try {
    await api.delete(`/api/admin/categories/${id}`, { token });
    await loadCategories();
  } catch {
    window.alert('Không xoá được danh mục, vui lòng thử lại.');
  }
}

document.querySelector('[data-add-category]').addEventListener('click', () => showForm(null));
document.querySelector('[data-cancel-category]').addEventListener('click', () => {
  formPanel.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const formData = new FormData(form);
  const payload = {
    name: formData.get('name').trim(),
    slug: formData.get('slug').trim(),
    description: formData.get('description').trim(),
    image_url: formData.get('image_url').trim(),
    parent_id: formData.get('parent_id') || null,
    sort_order: Number(formData.get('sort_order')) || 0,
    is_active: formData.get('is_active') === 'on',
  };
  const categoryId = formData.get('categoryId');

  try {
    if (categoryId) {
      await api.put(`/api/admin/categories/${categoryId}`, payload, { token });
    } else {
      await api.post('/api/admin/categories', payload, { token });
    }
    formPanel.hidden = true;
    await loadCategories();
  } catch (err) {
    formError.hidden = false;
    formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được danh mục.';
  }
});

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await loadCategories();
}

init();
