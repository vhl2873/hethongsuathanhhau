import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';

export const adminCouponsRouter = Router();
adminCouponsRouter.use(requireAuth, requireAdmin);

adminCouponsRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw new AppError('COUPONS_FETCH_FAILED', 'Không tải được mã giảm giá.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validateCouponInput(body) {
  if (!isNonEmptyString(body.code)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập mã giảm giá.', 400);
  if (!['percentage', 'fixed'].includes(body.discount_type)) {
    throw new AppError('VALIDATION_ERROR', 'Loại giảm giá không hợp lệ.', 400);
  }
  if (!Number.isFinite(Number(body.discount_value)) || Number(body.discount_value) < 0) {
    throw new AppError('VALIDATION_ERROR', 'Giá trị giảm giá không hợp lệ.', 400);
  }
}

function couponPayload(body) {
  return {
    code: body.code.toUpperCase().trim(),
    description: body.description || null,
    discount_type: body.discount_type,
    discount_value: Number(body.discount_value),
    min_order_amount: Number(body.min_order_amount) || 0,
    max_discount_amount: body.max_discount_amount ? Number(body.max_discount_amount) : null,
    usage_limit: body.usage_limit ? Number(body.usage_limit) : null,
    starts_at: body.starts_at || null,
    expires_at: body.expires_at || null,
    is_active: body.is_active ?? true,
  };
}

adminCouponsRouter.post('/', async (req, res, next) => {
  try {
    validateCouponInput(req.body);
    const { data, error } = await supabaseAdmin.from('coupons').insert(couponPayload(req.body)).select().single();
    if (error) throw new AppError('COUPON_CREATE_FAILED', 'Không tạo được mã giảm giá (mã có thể đã tồn tại).', 400);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.put('/:id', async (req, res, next) => {
  try {
    validateCouponInput(req.body);
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .update(couponPayload(req.body))
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('COUPON_UPDATE_FAILED', 'Không cập nhật được mã giảm giá.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminCouponsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', req.params.id);
    if (error) throw new AppError('COUPON_DELETE_FAILED', 'Không xoá được mã giảm giá.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
