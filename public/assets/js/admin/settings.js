import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
const root = document.querySelector('[data-settings-root]');

function renderForm(settings) {
  const social = settings.social_links || {};
  const esc = (value) => escapeHtml(value || '');
  root.innerHTML = `
    <h1 class="page-title">Cài đặt cửa hàng</h1>
    <div class="admin-form-panel" style="max-width:640px">
      <div class="alert alert--success" data-form-success hidden></div>
      <div class="alert alert--danger" data-form-error hidden></div>
      <form data-settings-form novalidate>
        <div class="field">
          <label class="field__label" for="s-name">Tên cửa hàng</label>
          <input class="input" id="s-name" name="store_name" value="${esc(settings.store_name)}" />
        </div>
        <div class="field">
          <label class="field__label" for="s-address">Địa chỉ</label>
          <input class="input" id="s-address" name="store_address" value="${esc(settings.store_address)}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="s-phone">Điện thoại</label>
            <input class="input" id="s-phone" name="store_phone" value="${esc(settings.store_phone)}" />
          </div>
          <div class="field">
            <label class="field__label" for="s-hotline">Hotline</label>
            <input class="input" id="s-hotline" name="store_hotline" value="${esc(settings.store_hotline)}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="s-email">Email</label>
            <input class="input" type="email" id="s-email" name="store_email" value="${esc(settings.store_email)}" />
          </div>
          <div class="field">
            <label class="field__label" for="s-hours">Giờ mở cửa</label>
            <input class="input" id="s-hours" name="opening_hours" value="${esc(settings.opening_hours)}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="s-facebook">Facebook</label>
            <input class="input" id="s-facebook" name="facebook" value="${esc(social.facebook)}" />
          </div>
          <div class="field">
            <label class="field__label" for="s-zalo">Zalo</label>
            <input class="input" id="s-zalo" name="zalo" value="${esc(social.zalo)}" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="s-logo">URL logo</label>
          <input class="input" id="s-logo" name="logo_url" value="${esc(settings.logo_url)}" />
        </div>
        <button type="submit" class="btn btn--primary">Lưu cài đặt</button>
      </form>
    </div>`;

  const form = root.querySelector('[data-settings-form]');
  const successEl = root.querySelector('[data-form-success]');
  const errorEl = root.querySelector('[data-form-error]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    successEl.hidden = true;
    errorEl.hidden = true;
    const formData = new FormData(form);

    const payload = {
      store_name: formData.get('store_name').trim(),
      store_address: formData.get('store_address').trim(),
      store_phone: formData.get('store_phone').trim(),
      store_hotline: formData.get('store_hotline').trim(),
      store_email: formData.get('store_email').trim(),
      opening_hours: formData.get('opening_hours').trim(),
      social_links: { facebook: formData.get('facebook').trim(), zalo: formData.get('zalo').trim() },
      logo_url: formData.get('logo_url').trim(),
    };

    try {
      await api.put('/api/admin/settings', payload, { token });
      successEl.hidden = false;
      successEl.textContent = 'Đã lưu cài đặt cửa hàng.';
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err instanceof ApiError ? err.message : 'Không lưu được cài đặt.';
    }
  });
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  root.innerHTML = '<div class="skeleton" style="height:400px;border-radius:16px"></div>';
  try {
    const settings = await api.get('/api/admin/settings', { token });
    renderForm(settings);
  } catch {
    root.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được cài đặt cửa hàng</p></div>`;
  }
}

init();
