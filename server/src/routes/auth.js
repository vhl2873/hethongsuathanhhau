import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isValidPhone, isNonEmptyString } from '../lib/validators.js';

export const authRouter = Router();
authRouter.use(requireAuth);

authRouter.get('/me', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role')
      .eq('id', req.user.id)
      .single();
    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy hồ sơ người dùng.', 404);
    res.json({ data: { ...data, email: req.user.email } });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/profile', async (req, res, next) => {
  try {
    const { full_name: fullName, phone } = req.body;
    if (phone && !isValidPhone(phone)) throw new AppError('VALIDATION_ERROR', 'Số điện thoại không hợp lệ.', 400);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, full_name, phone, role')
      .single();
    if (error) throw new AppError('PROFILE_UPDATE_FAILED', 'Không cập nhật được hồ sơ.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/addresses', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false });
    if (error) throw new AppError('ADDRESSES_FETCH_FAILED', 'Không tải được sổ địa chỉ.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validateAddressInput(body) {
  const { recipient_name: recipientName, phone, address_line: addressLine, province } = body;
  if (!isNonEmptyString(recipientName) || !isValidPhone(phone) || !isNonEmptyString(addressLine) || !isNonEmptyString(province)) {
    throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập đầy đủ thông tin địa chỉ (tên, số điện thoại, địa chỉ, tỉnh/thành).', 400);
  }
}

authRouter.post('/addresses', async (req, res, next) => {
  try {
    validateAddressInput(req.body);
    const { recipient_name, phone, address_line, ward, district, province, is_default } = req.body;

    if (is_default) {
      await supabaseAdmin.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }

    const { data, error } = await supabaseAdmin
      .from('addresses')
      .insert({ user_id: req.user.id, recipient_name, phone, address_line, ward, district, province, is_default: !!is_default })
      .select()
      .single();
    if (error) throw new AppError('ADDRESS_CREATE_FAILED', 'Không thêm được địa chỉ.', 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

authRouter.put('/addresses/:id', async (req, res, next) => {
  try {
    validateAddressInput(req.body);
    const { recipient_name, phone, address_line, ward, district, province, is_default } = req.body;

    if (is_default) {
      await supabaseAdmin.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }

    const { data, error } = await supabaseAdmin
      .from('addresses')
      .update({ recipient_name, phone, address_line, ward, district, province, is_default: !!is_default })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy địa chỉ này.', 404);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/addresses/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('addresses').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw new AppError('ADDRESS_DELETE_FAILED', 'Không xoá được địa chỉ.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/wishlist', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('wishlists')
      .select('id, created_at, product:products(id, name, slug, base_price, is_active, product_images(url, is_primary))')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new AppError('WISHLIST_FETCH_FAILED', 'Không tải được danh sách yêu thích.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/wishlist', async (req, res, next) => {
  try {
    const productId = Number(req.body.productId ?? req.body.product_id);
    if (!Number.isInteger(productId) || productId <= 0) throw new AppError('VALIDATION_ERROR', 'Sản phẩm không hợp lệ.', 400);

    const { error } = await supabaseAdmin
      .from('wishlists')
      .upsert({ user_id: req.user.id, product_id: productId }, { onConflict: 'user_id,product_id' });
    if (error) throw new AppError('WISHLIST_ADD_FAILED', 'Không thêm được vào danh sách yêu thích.', 500);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/wishlist/:productId', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('wishlists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.productId);
    if (error) throw new AppError('WISHLIST_REMOVE_FAILED', 'Không xoá được khỏi danh sách yêu thích.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
