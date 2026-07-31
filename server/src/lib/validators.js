// Hand-written validation, no library. Client-side copy of this logic
// (public/assets/js/lib/validators.js) is UX-only - this server copy is the
// authoritative source of truth and is what actually gates writes.

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value) {
  return typeof value === 'string' && /^(0|\+84)[0-9]{9,10}$/.test(value.trim().replace(/[\s.-]/g, ''));
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function validateCheckoutInput(body) {
  const errors = [];

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Giỏ hàng đang trống.');
  } else {
    for (const item of body.items) {
      if (!isPositiveInteger(item.variant_id) || !isPositiveInteger(item.quantity)) {
        errors.push('Thông tin sản phẩm trong giỏ hàng không hợp lệ.');
        break;
      }
    }
  }

  if (!body.userId) {
    if (!isNonEmptyString(body.guestName)) errors.push('Vui lòng nhập họ tên.');
    if (!isValidPhone(body.guestPhone)) errors.push('Số điện thoại không hợp lệ.');
    if (body.guestEmail && !isValidEmail(body.guestEmail)) errors.push('Email không hợp lệ.');
  }

  if (!body.shippingAddress || !isNonEmptyString(body.shippingAddress.address_line) || !isNonEmptyString(body.shippingAddress.province)) {
    errors.push('Vui lòng nhập đầy đủ địa chỉ giao hàng.');
  }

  return errors;
}

export function validateContactInput(body) {
  const errors = [];
  if (!isNonEmptyString(body.name)) errors.push('Vui lòng nhập họ tên.');
  if (!isValidEmail(body.email)) errors.push('Email không hợp lệ.');
  if (body.phone && !isValidPhone(body.phone)) errors.push('Số điện thoại không hợp lệ.');
  if (!isNonEmptyString(body.message)) errors.push('Vui lòng nhập nội dung liên hệ.');
  return errors;
}

export function validateReviewInput(body) {
  const errors = [];
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    errors.push('Vui lòng chọn số sao đánh giá (1-5).');
  }
  if (!isNonEmptyString(body.content)) {
    errors.push('Vui lòng nhập nội dung đánh giá.');
  }
  return errors;
}
