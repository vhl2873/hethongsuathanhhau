import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAuth, requireAdmin);

// Only these transitions are allowed via the status-update endpoint below -
// prevents nonsensical admin actions like completed -> pending. cancelled
// and refunded are terminal; pending can go forward or be cancelled.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

adminOrdersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('orders')
      .select('id, order_number, guest_name, guest_email, user_id, status, payment_status, total_amount, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error, count } = await query;
    if (error) throw new AppError('ORDERS_FETCH_FAILED', 'Không tải được danh sách đơn hàng.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminOrdersRouter.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*), order_status_history(*), shipping_methods(name), payment_methods(name)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng này.', 404);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Sets shipping/payment method after the store calls the customer to
// confirm delivery details (checkout no longer collects these upfront -
// see public/assets/js/pages/checkout.js). Shipping fee is always looked up
// server-side from the chosen method, never trusted from the request body.
adminOrdersRouter.patch('/:id/fulfillment', async (req, res, next) => {
  try {
    const shippingMethodId = req.body.shippingMethodId ?? null;
    const paymentMethodId = req.body.paymentMethodId ?? null;

    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('subtotal, discount_amount')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng này.', 404);

    let shippingFee = 0;
    if (shippingMethodId) {
      const { data: method } = await supabaseAdmin
        .from('shipping_methods')
        .select('fee')
        .eq('id', shippingMethodId)
        .eq('is_active', true)
        .maybeSingle();
      if (!method) throw new AppError('INVALID_SHIPPING_METHOD', 'Phương thức vận chuyển không hợp lệ.', 400);
      shippingFee = method.fee;
    }

    const totalAmount = order.subtotal - order.discount_amount + shippingFee;

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        shipping_method_id: shippingMethodId,
        payment_method_id: paymentMethodId,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError('ORDER_UPDATE_FAILED', 'Không cập nhật được đơn hàng.', 500);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminOrdersRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status: nextStatus, note } = req.body;
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('status')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng này.', 404);

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `Không thể chuyển đơn hàng từ trạng thái "${order.status}" sang "${nextStatus}".`,
        400,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError('ORDER_UPDATE_FAILED', 'Không cập nhật được đơn hàng.', 500);

    await supabaseAdmin
      .from('order_status_history')
      .insert({ order_id: req.params.id, status: nextStatus, note: note || null, changed_by: req.user.id });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});
