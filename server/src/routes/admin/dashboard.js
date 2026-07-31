import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAuth, requireAdmin);

async function countRows(table, filters = {}) {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { count } = await query;
  return count ?? 0;
}

adminDashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const [productCount, orderCount, pendingOrderCount, customerCount, pendingReviewCount, recentOrders] = await Promise.all([
      countRows('products'),
      countRows('orders'),
      countRows('orders', { status: 'pending' }),
      countRows('profiles', { role: 'customer' }),
      countRows('reviews', { is_approved: false }),
      supabaseAdmin
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    res.json({
      data: {
        product_count: productCount,
        order_count: orderCount,
        pending_order_count: pendingOrderCount,
        customer_count: customerCount,
        pending_review_count: pendingReviewCount,
        recent_orders: recentOrders.data || [],
      },
    });
  } catch (err) {
    next(err);
  }
});
