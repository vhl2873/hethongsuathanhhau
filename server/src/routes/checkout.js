import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { attachUserIfPresent } from '../middleware/requireAuth.js';
import { validateCheckoutInput } from '../lib/validators.js';
import { calculateSubtotal, calculateCouponDiscount, calculateTotal } from '../services/pricing.js';
import { createOrder } from '../services/inventory.js';

export const checkoutRouter = Router();

checkoutRouter.get('/shipping-methods', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic
      .from('shipping_methods')
      .select('id, name, description, fee')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw new AppError('SHIPPING_METHODS_FETCH_FAILED', 'Không tải được phương thức vận chuyển.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

checkoutRouter.get('/payment-methods', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic
      .from('payment_methods')
      .select('id, name, description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw new AppError('PAYMENT_METHODS_FETCH_FAILED', 'Không tải được phương thức thanh toán.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Best-effort preview only - the real discount is always recomputed inside
// checkout_create_order at order-creation time, never trusted from here.
checkoutRouter.post('/validate-coupon', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code || !Number.isFinite(subtotal)) {
      throw new AppError('VALIDATION_ERROR', 'Thiếu mã giảm giá hoặc tạm tính.', 400);
    }

    const { data: coupon } = await supabaseAdmin.from('coupons').select('*').eq('code', code).single();
    if (!coupon) {
      throw new AppError('COUPON_NOT_FOUND', 'Mã giảm giá không tồn tại.', 404);
    }

    const discountAmount = calculateCouponDiscount({ subtotal, coupon });
    if (discountAmount <= 0) {
      throw new AppError('COUPON_NOT_APPLICABLE', 'Mã giảm giá không áp dụng được cho đơn hàng này.', 400);
    }

    res.json({ data: { code: coupon.code, discount_amount: discountAmount } });
  } catch (err) {
    next(err);
  }
});

checkoutRouter.post('/', attachUserIfPresent, async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateCheckoutInput({ ...body, userId: req.user?.id });
    if (errors.length) throw new AppError('VALIDATION_ERROR', errors[0], 400, { errors });

    const result = await createOrder({
      userId: req.user?.id,
      guestEmail: body.guestEmail,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      shippingAddress: body.shippingAddress,
      shippingMethodId: body.shippingMethodId,
      paymentMethodId: body.paymentMethodId,
      couponCode: body.couponCode,
      items: body.items,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});
