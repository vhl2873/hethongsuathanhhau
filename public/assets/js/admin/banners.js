import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let banners = [];

const tableRoot = document.querySelector('[data-banners-table]');
const formPanel = document.querySelector('[data-banner-form-panel]');
const form = document.querySelector('[data-banner-form]');
const formError = document.querySelector('[data-banner-form-error]');
const formHeading = document.querySelector('[data-banner-form-heading]');
const imageFileInput = document.querySelector('#b-image-file');
const imagePreview = document.querySelector('[data-banner-image-preview]');
const imageError = document.querySelector('[data-banner-image-error]');

// Uploads a single image file to Supabase Storage via the admin API and
// returns its public URL. Never uploads directly from the browser to
// Storage - always goes through the server so the service-role key stays
// server-side and requireAdmin gates who can write to the bucket.
async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const result = await api.post('/api/admin/storage/upload', formData, { token });
  return result.url;
}

function renderImagePreview(url) {
  imagePreview.innerHTML = url ? `<div class="admin-image-item"><img src="${escapeHtml(url)}" alt="" width="120" height="68" style="object-fit:cover" /></div>` : '';
}

function render() {
  renderTable({
    container: tableRoot,
    rows: banners,
    getRowId: (b) => b.id,
    emptyMessage: 'Chưa có banner nào.',
    columns: [
      { label: 'Ảnh', render: (b) => `<img src="${escapeHtml(b.image_url)}" alt="" width="64" height="36" style="object-fit:cover;border-radius:4px" />` },
      { label: 'Tiêu đề', render: (b) => escapeHtml(b.title || '-') },
      { key: 'position', label: 'Vị trí' },
      { key: 'sort_order', label: 'Thứ tự' },
      {
        label: 'Trạng thái',
        render: (b) => (b.is_active ? '<span class="badge badge--success">Hiện</span>' : '<span class="badge badge--danger">Ẩn</span>'),
      },
    ],
    rowActions: (b) => `
      <button type="button" class="btn btn--outline" data-edit="${b.id}">Sửa</button>
      <button type="button" class="btn btn--danger" data-delete="${b.id}">Xoá</button>`,
  });

  tableRoot.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => showForm(banners.find((b) => b.id === Number(btn.dataset.edit))));
  });
  tableRoot.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(Number(btn.dataset.delete)));
  });
}

function showForm(banner) {
  formPanel.hidden = false;
  formError.hidden = true;
  imageError.textContent = '';
  imageFileInput.value = '';
  formHeading.textContent = banner ? 'Sửa banner' : 'Thêm banner mới';
  form.elements.bannerId.value = banner?.id || '';
  form.elements.title.value = banner?.title || '';
  form.elements.image_url.value = banner?.image_url || '';
  renderImagePreview(banner?.image_url || '');
  form.elements.link_url.value = banner?.link_url || '';
  form.elements.position.value = banner?.position || 'home_hero';
  form.elements.sort_order.value = banner?.sort_order ?? 0;
  form.elements.is_active.checked = banner ? banner.is_active : true;
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function loadBanners() {
  tableRoot.innerHTML = '<div class="skeleton" style="height:200px;border-radius:16px"></div>';
  try {
    banners = await api.get('/api/admin/banners', { token });
    render();
  } catch {
    tableRoot.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được banner</p></div>`;
  }
}

async function handleDelete(id) {
  const confirmed = await confirmDialog({ title: 'Xoá banner', message: 'Xoá banner này?' });
  if (!confirmed) return;
  try {
    await api.delete(`/api/admin/banners/${id}`, { token });
    await loadBanners();
  } catch {
    window.alert('Không xoá được banner.');
  }
}

imageFileInput.addEventListener('change', async () => {
  const file = imageFileInput.files[0];
  if (!file) return;

  imageError.textContent = '';
  imageFileInput.disabled = true;
  renderImagePreview(URL.createObjectURL(file));

  try {
    const url = await uploadImageFile(file);
    form.elements.image_url.value = url;
    renderImagePreview(url);
  } catch (err) {
    imageError.textContent = err instanceof ApiError ? err.message : 'Không tải ảnh lên được, vui lòng thử lại.';
    renderImagePreview(form.elements.image_url.value);
  } finally {
    imageFileInput.disabled = false;
  }
});

document.querySelector('[data-add-banner]').addEventListener('click', () => showForm(null));
document.querySelector('[data-cancel-banner]').addEventListener('click', () => {
  formPanel.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;
  const formData = new FormData(form);
  const payload = {
    title: formData.get('title').trim(),
    image_url: formData.get('image_url').trim(),
    link_url: formData.get('link_url').trim(),
    position: formData.get('position'),
    sort_order: Number(formData.get('sort_order')) || 0,
    is_active: formData.get('is_active') === 'on',
  };
  const bannerId = formData.get('bannerId');

  if (!payload.image_url) {
    imageError.textContent = 'Vui lòng chọn 1 ảnh cho banner.';
    return;
  }

  try {
    if (bannerId) {
      await api.put(`/api/admin/banners/${bannerId}`, payload, { token });
    } else {
      await api.post('/api/admin/banners', payload, { token });
    }
    formPanel.hidden = true;
    await loadBanners();
  } catch (err) {
    formError.hidden = false;
    formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được banner.';
  }
});

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;
  await loadBanners();
}

init();
