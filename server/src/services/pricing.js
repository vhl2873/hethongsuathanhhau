// Pure pricing calculations shared by the checkout preview endpoints
// (POST /api/checkout/validate-coupon, cart totals) and, conceptually,
// mirrored by the checkout_create_order SQL function - which stays the
// authoritative calculation for the actual order write. These functions
// never touch the network/DB so they're trivial to unit test.

export function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function isCouponUsable({ subtotal, coupon, now = new Date() }) {
  if (!coupon || !coupon.is_active) return false;
  if (coupon.starts_at && now < new Date(coupon.starts_at)) return false;
  if (coupon.expires_at && now > new Date(coupon.expires_at)) return false;
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return false;
  if (subtotal < coupon.min_order_amount) return false;
  return true;
}

export function calculateCouponDiscount({ subtotal, coupon, now = new Date() }) {
  if (!isCouponUsable({ subtotal, coupon, now })) return 0;

  if (coupon.discount_type === 'percentage') {
    const raw = Math.floor((subtotal * coupon.discount_value) / 100);
    return coupon.max_discount_amount != null ? Math.min(raw, coupon.max_discount_amount) : raw;
  }

  // fixed
  return Math.min(coupon.discount_value, subtotal);
}

export function calculateTotal({ subtotal, discountAmount, shippingFee }) {
  return subtotal - discountAmount + shippingFee;
}
