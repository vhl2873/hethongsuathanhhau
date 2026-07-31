// Client-side mirror of server/src/lib/validators.js - UX only. The server
// copy is the actual source of truth; never assume this file's pass means
// the request will succeed.

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value) {
  return typeof value === 'string' && /^(0|\+84)[0-9]{9,10}$/.test(value.trim().replace(/[\s.-]/g, ''));
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateCheckoutForm(form) {
  const errors = {};

  if (!isNonEmptyString(form.guestName)) errors.guestName = 'Vui lòng nhập họ tên.';
  if (!isValidPhone(form.guestPhone)) errors.guestPhone = 'Số điện thoại không hợp lệ.';
  if (form.guestEmail && !isValidEmail(form.guestEmail)) errors.guestEmail = 'Email không hợp lệ.';
  if (!isNonEmptyString(form.addressLine)) errors.addressLine = 'Vui lòng nhập địa chỉ.';
  if (!isNonEmptyString(form.province)) errors.province = 'Vui lòng nhập tỉnh/thành phố.';

  return errors;
}

export function validateReviewForm(form) {
  const errors = {};
  if (!form.rating || form.rating < 1 || form.rating > 5) errors.rating = 'Vui lòng chọn số sao.';
  if (!isNonEmptyString(form.content)) errors.content = 'Vui lòng nhập nội dung đánh giá.';
  return errors;
}
