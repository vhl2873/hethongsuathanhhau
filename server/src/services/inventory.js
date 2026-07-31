import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { mapCheckoutError } from './checkoutErrors.js';

// Wraps the checkout_create_order RPC (see server/supabase/schema.sql),
// which does the actual, authoritative, transaction-safe stock decrement +
// order creation. This function never recomputes prices/stock itself - it
// only forwards inputs and translates Postgres errors into AppError.
export async function createOrder({
  userId,
  guestEmail,
  guestName,
  guestPhone,
  shippingAddress,
  shippingMethodId,
  paymentMethodId,
  couponCode,
  items,
}) {
  const { data, error } = await supabaseAdmin.rpc('checkout_create_order', {
    p_user_id: userId ?? null,
    p_guest_email: guestEmail ?? null,
    p_guest_name: guestName ?? null,
    p_guest_phone: guestPhone ?? null,
    p_shipping_address: shippingAddress,
    p_shipping_method_id: shippingMethodId ?? null,
    p_payment_method_id: paymentMethodId ?? null,
    p_coupon_code: couponCode ?? null,
    p_items: items,
  });

  if (error) {
    throw mapCheckoutError(error);
  }
  return data;
}
