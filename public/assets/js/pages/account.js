import { getSession, signOut } from '../auth.js';
import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-account-root]');
let token = null;

function renderAddress(address) {
  const line = [address.address_line, address.ward, address.district, address.province].filter(Boolean).join(', ');
  return `
    <div class="address-item" data-address-id="${address.id}">
      <div class="address-item__info">
        <p><strong>${escapeHtml(address.recipient_name)}</strong> - ${escapeHtml(address.phone)}</p>
        <p>${escapeHtml(line)}</p>
        ${address.is_default ? '<span class="badge badge--success">Mặc định</span>' : ''}
      </div>
      <div class="address-item__actions">
        <button type="button" class="btn btn--outline" data-edit-address>Sửa</button>
        <button type="button" class="btn btn--danger" data-delete-address>Xoá</button>
      </div>
    </div>`;
}

function render(profile, addresses) {
  root.innerHTML = `
    <div class="account-layout">
      <section class="card account-section">
        <h2 class="account-section__heading">Thông tin cá nhân</h2>
        <form data-profile-form novalidate>
          <div class="field">
            <label class="field__label" for="fullName">Họ tên</label>
            <input class="input" id="fullName" name="fullName" value="${escapeHtml(profile.full_name || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="phone">Số điện thoại</label>
            <input class="input" id="phone" name="phone" value="${escapeHtml(profile.phone || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="email">Email</label>
            <input class="input" id="email" value="${escapeHtml(profile.email || '')}" disabled />
          </div>
          <button type="submit" class="btn btn--primary">Lưu thay đổi</button>
          <p class="account-section__feedback" data-profile-feedback role="status"></p>
        </form>
      </section>

      <section class="card account-section">
        <h2 class="account-section__heading">Sổ địa chỉ</h2>
        <div class="address-list" data-address-list>
          ${addresses.length ? addresses.map(renderAddress).join('') : '<p class="empty-state__title">Chưa có địa chỉ nào.</p>'}
        </div>
        <button type="button" class="btn btn--outline" data-add-address>+ Thêm địa chỉ mới</button>

        <form class="address-form" data-address-form hidden novalidate>
          <input type="hidden" name="addressId" />
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="addr-name">Tên người nhận</label>
              <input class="input" id="addr-name" name="recipientName" required />
            </div>
            <div class="field">
              <label class="field__label" for="addr-phone">Số điện thoại</label>
              <input class="input" id="addr-phone" name="phone" required />
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="addr-line">Địa chỉ</label>
            <input class="input" id="addr-line" name="addressLine" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="addr-ward">Phường/Xã</label>
              <input class="input" id="addr-ward" name="ward" />
            </div>
            <div class="field">
              <label class="field__label" for="addr-district">Quận/Huyện</label>
              <input class="input" id="addr-district" name="district" />
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="addr-province">Tỉnh/Thành phố</label>
            <input class="input" id="addr-province" name="province" required />
          </div>
          <label class="address-form__checkbox">
            <input type="checkbox" name="isDefault" /> Đặt làm địa chỉ mặc định
          </label>
          <div class="alert alert--danger" data-address-form-error hidden></div>
          <div class="address-form__actions">
            <button type="submit" class="btn btn--primary">Lưu địa chỉ</button>
            <button type="button" class="btn btn--outline" data-cancel-address>Hủy</button>
          </div>
        </form>
      </section>

      <button type="button" class="btn btn--danger" data-logout>Đăng xuất</button>
    </div>`;

  wireInteractions(addresses);
}

function wireInteractions(addresses) {
  const profileForm = root.querySelector('[data-profile-form]');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = root.querySelector('[data-profile-feedback]');
    const formData = new FormData(profileForm);
    try {
      await api.patch(
        '/api/auth/profile',
        { full_name: formData.get('fullName').trim(), phone: formData.get('phone').trim() },
        { token },
      );
      feedback.textContent = 'Đã lưu thay đổi.';
      feedback.classList.remove('is-error');
    } catch (err) {
      feedback.textContent = err instanceof ApiError ? err.message : 'Không lưu được thay đổi.';
      feedback.classList.add('is-error');
    }
    setTimeout(() => {
      feedback.textContent = '';
    }, 3000);
  });

  const addressForm = root.querySelector('[data-address-form]');
  const addressFormError = root.querySelector('[data-address-form-error]');

  function showAddressForm(address) {
    addressForm.hidden = false;
    addressFormError.hidden = true;
    addressForm.elements.addressId.value = address?.id || '';
    addressForm.elements.recipientName.value = address?.recipient_name || '';
    addressForm.elements.phone.value = address?.phone || '';
    addressForm.elements.addressLine.value = address?.address_line || '';
    addressForm.elements.ward.value = address?.ward || '';
    addressForm.elements.district.value = address?.district || '';
    addressForm.elements.province.value = address?.province || '';
    addressForm.elements.isDefault.checked = !!address?.is_default;
    addressForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  root.querySelector('[data-add-address]').addEventListener('click', () => showAddressForm(null));
  root.querySelector('[data-cancel-address]').addEventListener('click', () => {
    addressForm.hidden = true;
  });

  root.querySelectorAll('[data-edit-address]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('[data-address-id]').dataset.addressId);
      showAddressForm(addresses.find((a) => a.id === id));
    });
  });

  root.querySelectorAll('[data-delete-address]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('[data-address-id]').dataset.addressId;
      if (!window.confirm('Xoá địa chỉ này?')) return;
      try {
        await api.delete(`/api/auth/addresses/${id}`, { token });
        init();
      } catch {
        window.alert('Không xoá được địa chỉ, vui lòng thử lại.');
      }
    });
  });

  addressForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    addressFormError.hidden = true;
    const formData = new FormData(addressForm);
    const payload = {
      recipient_name: formData.get('recipientName').trim(),
      phone: formData.get('phone').trim(),
      address_line: formData.get('addressLine').trim(),
      ward: formData.get('ward').trim(),
      district: formData.get('district').trim(),
      province: formData.get('province').trim(),
      is_default: formData.get('isDefault') === 'on',
    };
    const addressId = formData.get('addressId');

    try {
      if (addressId) {
        await api.put(`/api/auth/addresses/${addressId}`, payload, { token });
      } else {
        await api.post('/api/auth/addresses', payload, { token });
      }
      init();
    } catch (err) {
      addressFormError.hidden = false;
      addressFormError.textContent = err instanceof ApiError ? err.message : 'Không lưu được địa chỉ.';
    }
  });

  root.querySelector('[data-logout]').addEventListener('click', async () => {
    await signOut();
    window.location.href = './index.html';
  });
}

async function init() {
  const session = await getSession();
  if (!session) {
    window.location.href = './login.html?redirect=' + encodeURIComponent('./account.html');
    return;
  }
  token = session.access_token;

  root.innerHTML = '<div class="skeleton" style="height:320px;border-radius:16px"></div>';

  try {
    const [profile, addresses] = await Promise.all([
      api.get('/api/auth/me', { token }),
      api.get('/api/auth/addresses', { token }),
    ]);
    render(profile, addresses);
  } catch {
    root.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được thông tin tài khoản</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

init();
