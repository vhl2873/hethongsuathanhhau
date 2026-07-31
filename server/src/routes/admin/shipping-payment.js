import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';

export const adminShippingPaymentRouter = Router();
adminShippingPaymentRouter.use(requireAuth, requireAdmin);

function validateNameInput(body) {
  if (!isNonEmptyString(body.name)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập tên.', 400);
}

// --- Shipping methods -------------------------------------------------------
adminShippingPaymentRouter.get('/shipping-methods', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('shipping_methods').select('*').order('sort_order', { ascending: true });
    if (error) throw new AppError('SHIPPING_METHODS_FETCH_FAILED', 'Không tải được phương thức vận chuyển.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.post('/shipping-methods', async (req, res, next) => {
  try {
    validateNameInput(req.body);
    const { name, description, fee, sort_order, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('shipping_methods')
      .insert({ name, description, fee: Number(fee) || 0, sort_order: Number(sort_order) || 0, is_active: is_active ?? true })
      .select()
      .single();
    if (error) throw new AppError('SHIPPING_METHOD_CREATE_FAILED', 'Không tạo được phương thức vận chuyển.', 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.put('/shipping-methods/:id', async (req, res, next) => {
  try {
    validateNameInput(req.body);
    const { name, description, fee, sort_order, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('shipping_methods')
      .update({ name, description, fee: Number(fee) || 0, sort_order: Number(sort_order) || 0, is_active: is_active ?? true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('SHIPPING_METHOD_UPDATE_FAILED', 'Không cập nhật được phương thức vận chuyển.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.delete('/shipping-methods/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('shipping_methods').delete().eq('id', req.params.id);
    if (error) throw new AppError('SHIPPING_METHOD_DELETE_FAILED', 'Không xoá được phương thức vận chuyển.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// --- Payment methods ---------------------------------------------------------
adminShippingPaymentRouter.get('/payment-methods', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('payment_methods').select('*').order('sort_order', { ascending: true });
    if (error) throw new AppError('PAYMENT_METHODS_FETCH_FAILED', 'Không tải được phương thức thanh toán.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.post('/payment-methods', async (req, res, next) => {
  try {
    validateNameInput(req.body);
    const { name, description, sort_order, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({ name, description, sort_order: Number(sort_order) || 0, is_active: is_active ?? true })
      .select()
      .single();
    if (error) throw new AppError('PAYMENT_METHOD_CREATE_FAILED', 'Không tạo được phương thức thanh toán.', 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.put('/payment-methods/:id', async (req, res, next) => {
  try {
    validateNameInput(req.body);
    const { name, description, sort_order, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .update({ name, description, sort_order: Number(sort_order) || 0, is_active: is_active ?? true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('PAYMENT_METHOD_UPDATE_FAILED', 'Không cập nhật được phương thức thanh toán.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminShippingPaymentRouter.delete('/payment-methods/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('payment_methods').delete().eq('id', req.params.id);
    if (error) throw new AppError('PAYMENT_METHOD_DELETE_FAILED', 'Không xoá được phương thức thanh toán.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
