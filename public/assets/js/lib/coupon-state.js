import { api } from './api.js';

// The cart page lets a shopper check a code before they reach checkout, and
// checkout picks it up from here so the code doesn't have to be typed twice.
// Only the code is stored - the discount is always re-validated against the
// live subtotal by the server, never trusted from the browser.
const STORAGE_KEY = 'thanhhau_coupon_code';

export function getSavedCouponCode() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCouponCode(code) {
  try {
    if (code) sessionStorage.setItem(STORAGE_KEY, code);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private-mode browsers can refuse sessionStorage; the coupon just has
    // to be re-entered at checkout.
  }
}

// Returns { code, discount_amount } when the code applies to this subtotal,
// or null when it doesn't (expired, minimum not reached, unknown code).
export async function validateCoupon(code, subtotal) {
  if (!code) return null;
  try {
    return await api.post('/api/checkout/validate-coupon', { code, subtotal });
  } catch {
    return null;
  }
}
