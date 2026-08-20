import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';

export const couponsRouter = Router();

// The coupons table has no anon RLS policy on purpose (see schema.sql), so
// this reads through the service-role client and hand-picks the fields a
// shopper is allowed to see - never used_count/usage_limit, which would
// leak how a promotion is performing.
function formatCoupon(row) {
  return {
    code: row.code,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount) || 0,
    max_discount_amount: row.max_discount_amount === null ? null : Number(row.max_discount_amount),
    expires_at: row.expires_at,
  };
}

// GET /api/coupons?limit= - coupons a shopper can actually use right now:
// active, already started, not expired, and not used up. The window and
// usage checks run here rather than as PostgREST `or` filters so a
// timestamp never has to be escaped into a filter string.
couponsRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 8));

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select(
        'code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, starts_at, expires_at',
      )
      .eq('is_active', true)
      .order('min_order_amount', { ascending: true })
      .limit(100);

    if (error) throw new AppError('COUPONS_FETCH_FAILED', 'Không tải được mã giảm giá.', 500);

    const now = Date.now();
    const usable = data
      .filter((row) => !row.starts_at || new Date(row.starts_at).getTime() <= now)
      .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() >= now)
      .filter((row) => row.usage_limit === null || row.used_count < row.usage_limit)
      .slice(0, limit);

    res.json({ data: usable.map(formatCoupon) });
  } catch (err) {
    next(err);
  }
});
