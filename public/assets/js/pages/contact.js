import { api, ApiError } from '../lib/api.js';

const form = document.querySelector('[data-contact-form]');
const successEl = document.querySelector('[data-form-success]');
const errorEl = document.querySelector('[data-form-error]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  successEl.hidden = true;
  errorEl.hidden = true;

  const formData = new FormData(form);
  const payload = {
    name: formData.get('name').trim(),
    email: formData.get('email').trim(),
    phone: formData.get('phone').trim(),
    subject: formData.get('subject').trim(),
    message: formData.get('message').trim(),
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang gửi...';

  try {
    await api.post('/api/contact', payload);
    successEl.hidden = false;
    successEl.textContent = 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.';
    form.reset();
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = err instanceof ApiError ? err.message : 'Không gửi được liên hệ, vui lòng thử lại.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Gửi liên hệ';
  }
});
