import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);

async function getOrCreateCartId(userId) {
  const { data: existing } = await supabaseAdmin.from('carts').select('id').eq('user_id', userId).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin.from('carts').insert({ user_id: userId }).select('id').single();
  if (error) throw new AppError('CART_CREATE_FAILED', 'Không tạo được giỏ hàng.', 500);
  return created.id;
}

// GET /api/cart - DB-backed cart for logged-in users (separate from the
// guest localStorage cart in assets/js/cart.js).
cartRouter.get('/', async (req, res, next) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);
    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select(
        'id, quantity, variant:product_variants(id, name, sku, price, stock_quantity, product:products(id, name, slug, product_images(url, is_primary)))',
      )
      .eq('cart_id', cartId);
    if (error) throw new AppError('CART_FETCH_FAILED', 'Không tải được giỏ hàng.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

cartRouter.post('/items', async (req, res, next) => {
  try {
    const variantId = Number(req.body.variantId ?? req.body.variant_id);
    const quantity = Number(req.body.quantity) || 1;
    if (!Number.isInteger(variantId) || variantId <= 0 || quantity <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Thông tin sản phẩm không hợp lệ.', 400);
    }

    const cartId = await getOrCreateCartId(req.user.id);
    const { data: existing } = await supabaseAdmin
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('variant_id', variantId)
      .maybeSingle();

    const result = existing
      ? await supabaseAdmin
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabaseAdmin.from('cart_items').insert({ cart_id: cartId, variant_id: variantId, quantity });

    if (result.error) throw new AppError('CART_UPDATE_FAILED', 'Không thêm được sản phẩm vào giỏ.', 500);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

cartRouter.patch('/items/:itemId', async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Số lượng không hợp lệ.', 400);
    }

    const cartId = await getOrCreateCartId(req.user.id);
    const { error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', req.params.itemId)
      .eq('cart_id', cartId);
    if (error) throw new AppError('CART_UPDATE_FAILED', 'Không cập nhật được giỏ hàng.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

cartRouter.delete('/items/:itemId', async (req, res, next) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);
    const { error } = await supabaseAdmin.from('cart_items').delete().eq('id', req.params.itemId).eq('cart_id', cartId);
    if (error) throw new AppError('CART_UPDATE_FAILED', 'Không xoá được sản phẩm khỏi giỏ.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

cartRouter.delete('/', async (req, res, next) => {
  try {
    const cartId = await getOrCreateCartId(req.user.id);
    const { error } = await supabaseAdmin.from('cart_items').delete().eq('cart_id', cartId);
    if (error) throw new AppError('CART_UPDATE_FAILED', 'Không xoá được giỏ hàng.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/merge - one-way, best-effort push of the guest localStorage
// cart into the DB cart at login time (see assets/js/auth.js). Adds to
// whatever quantity already exists in the DB cart for that variant; does
// not touch localStorage itself, that's the caller's job.
cartRouter.post('/merge', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.json({ data: { merged: 0 } });

    const cartId = await getOrCreateCartId(req.user.id);
    let merged = 0;

    for (const item of items) {
      const variantId = Number(item.variantId ?? item.variant_id);
      const quantity = Number(item.quantity) || 1;
      if (!Number.isInteger(variantId) || variantId <= 0) continue;

      const { data: existing } = await supabaseAdmin
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('variant_id', variantId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin.from('cart_items').insert({ cart_id: cartId, variant_id: variantId, quantity });
      }
      merged += 1;
    }

    res.json({ data: { merged } });
  } catch (err) {
    next(err);
  }
});
