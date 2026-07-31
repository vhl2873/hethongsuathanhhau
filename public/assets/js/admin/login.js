import { signIn, signOut, getSession } from '../auth.js';
import { api } from '../lib/api.js';

const form = document.querySelector('[data-admin-login-form]');
const errorEl = document.querySelector('[data-form-error]');

if (new URLSearchParams(window.location.search).get('error') === 'forbidden') {
  errorEl.hidden = false;
  errorEl.textContent = 'Tài khoản của bạn không có quyền truy cập trang quản trị.';
}

async function redirectIfAlreadyAdmin() {
  const session = await getSession();
  if (!session) return;
  try {
    const profile = await api.get('/api/auth/me', { token: session.access_token });
    if (['admin', 'staff'].includes(profile.role)) {
      window.location.href = './index.html';
    }
  } catch {
    // Ignore - user can just log in again below.
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const formData = new FormData(form);
  const email = formData.get('email').trim();
  const password = formData.get('password');

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đăng nhập...';

  try {
    const { session } = await signIn({ email, password });
    const profile = await api.get('/api/auth/me', { token: session.access_token });

    if (!['admin', 'staff'].includes(profile.role)) {
      await signOut();
      errorEl.hidden = false;
      errorEl.textContent = 'Tài khoản của bạn không có quyền truy cập trang quản trị.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập';
      return;
    }

    window.location.href = './index.html';
  } catch {
    errorEl.hidden = false;
    errorEl.textContent = 'Email hoặc mật khẩu không đúng.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng nhập';
  }
});

redirectIfAlreadyAdmin();
