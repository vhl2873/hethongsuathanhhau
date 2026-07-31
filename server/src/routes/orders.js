import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, payment_status, total_amount, created_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new AppError('ORDERS_FETCH_FAILED', 'Không tải được danh sách đơn hàng.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

// 404s (not 403) if the order exists but belongs to someone else - avoids
// confirming order-number existence to a caller who doesn't own it.
ordersRouter.get('/:orderNumber', async (req, res, next) => {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*), order_status_history(status, note, created_at)')
      .eq('order_number', req.params.orderNumber)
      .eq('user_id', req.user.id)
      .single();

    if (error || !order) throw new AppError('NOT_FOUND', 'Không tìm thấy đơn hàng này.', 404);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});
