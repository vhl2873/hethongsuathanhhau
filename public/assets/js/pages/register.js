import { signUp, getSession } from '../auth.js';

const form = document.querySelector('[data-register-form]');
const errorEl = document.querySelector('[data-form-error]');
const successEl = document.querySelector('[data-form-success]');

function mapAuthError(err) {
  const message = err?.message || '';
  if (message.includes('already registered') || message.includes('User already registered')) {
    return 'Email này đã được đăng ký.';
  }
  if (message.includes('Password should be')) return 'Mật khẩu chưa đủ mạnh, vui lòng chọn mật khẩu khác.';
  if (message.includes('invalid') && message.toLowerCase().includes('email')) return 'Địa chỉ email không hợp lệ.';
  return 'Đăng ký thất bại. Vui lòng thử lại.';
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
  successEl.hidden = true;

  const formData = new FormData(form);
  const fullName = formData.get('fullName').trim();
  const email = formData.get('email').trim();
  const password = formData.get('password');
  const passwordConfirm = formData.get('passwordConfirm');

  if (!fullName || !email || !password) {
    errorEl.hidden = false;
    errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
    return;
  }
  if (password.length < 6) {
    errorEl.hidden = false;
    errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
    return;
  }
  if (password !== passwordConfirm) {
    errorEl.hidden = false;
    errorEl.textContent = 'Mật khẩu xác nhận không khớp.';
    return;
  }

  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đăng ký...';

  try {
    const result = await signUp({ email, password, fullName });
    if (result.session) {
      window.location.href = './account.html';
      return;
    }
    form.hidden = true;
    successEl.hidden = false;
    successEl.textContent = 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.';
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = mapAuthError(err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng ký';
  }
});

redirectIfAlreadyLoggedIn();
