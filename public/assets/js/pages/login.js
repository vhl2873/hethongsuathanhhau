import { signIn, getSession, signInWithOAuth } from '../auth.js';

const form = document.querySelector('[data-login-form]');
const errorEl = document.querySelector('[data-form-error]');

document.querySelectorAll('[data-oauth]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await signInWithOAuth(btn.dataset.oauth);
    } catch {
      errorEl.hidden = false;
      errorEl.textContent = 'Không đăng nhập được, vui lòng thử lại.';
    }
  });
});

function mapAuthError(err) {
  const message = err?.message || '';
  if (message.includes('Invalid login credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (message.includes('Email not confirmed')) return 'Vui lòng xác nhận email trước khi đăng nhập.';
  return 'Đăng nhập thất bại. Vui lòng thử lại.';
}

async function redirectIfAlreadyLoggedIn() {
  const session = await getSession();
  if (session) {
    window.location.href = './account.html';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const formData = new FormData(form);
  const email = formData.get('email').trim();
  const password = formData.get('password');

  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đăng nhập...';

  try {
    await signIn({ email, password });
    const redirectTo = new URLSearchParams(window.location.search).get('redirect') || './account.html';
    window.location.href = redirectTo;
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = mapAuthError(err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng nhập';
  }
});

redirectIfAlreadyLoggedIn();
