import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';
import { slugify } from '../../lib/slugify.js';

export const adminProductsRouter = Router();
adminProductsRouter.use(requireAuth, requireAdmin);

adminProductsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('products')
      .select(
        'id, name, slug, base_price, is_active, is_featured, category:categories(name), product_variants(id, stock_quantity), product_images(url, is_primary)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);

    const { data, error, count } = await query;
    if (error) throw new AppError('PRODUCTS_FETCH_FAILED', 'Không tải được danh sách sản phẩm.', 500);

    const items = data.map((p) => {
      const images = p.product_images || [];
      const primaryImage = images.find((img) => img.is_primary) || images[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        base_price: p.base_price,
        is_active: p.is_active,
        is_featured: p.is_featured,
        category_name: p.category?.name || null,
        total_stock: (p.product_variants || []).reduce((sum, v) => sum + v.stock_quantity, 0),
        image_url: primaryImage?.url || null,
      };
    });

    res.json({ data: items, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, product_images(*), product_variants(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm này.', 404);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validateProductInput(body) {
  if (!isNonEmptyString(body.name)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập tên sản phẩm.', 400);
  if (!Number.isFinite(Number(body.base_price)) || Number(body.base_price) < 0) {
    throw new AppError('VALIDATION_ERROR', 'Giá sản phẩm không hợp lệ.', 400);
  }
}

adminProductsRouter.post('/', async (req, res, next) => {
  try {
    validateProductInput(req.body);
    const { name, short_description, description, brand, base_price, compare_at_price, category_id, is_active, is_featured } =
      req.body;
    const slug = isNonEmptyString(req.body.slug) ? slugify(req.body.slug) : slugify(name);

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        slug,
        short_description,
        description,
        brand,
        base_price,
        compare_at_price: compare_at_price || null,
        category_id: category_id || null,
        is_active: is_active ?? true,
        is_featured: is_featured ?? false,
      })
      .select()
      .single();
    if (error) throw new AppError('PRODUCT_CREATE_FAILED', 'Không tạo được sản phẩm (slug có thể đã tồn tại).', 400);

    // Every product needs at least one variant for checkout/inventory to
    // work (see server/supabase/schema.sql) - auto-create a default one so
    // an admin who doesn't care about variants isn't forced to think about
    // them, matching the "unified inventory model" decision from planning.
    // stock_quantity comes from the "Tồn kho ban đầu" field on the create
    // form so a new product isn't stuck at 0 until someone edits the variant.
    const { error: variantError } = await supabaseAdmin.from('product_variants').insert({
      product_id: product.id,
      name: 'Mặc định',
      sku: `SKU-${product.id}-DEFAULT`,
      price: base_price,
      stock_quantity: Math.max(0, Number(req.body.stock_quantity) || 0),
    });
    if (variantError) {
      await supabaseAdmin.from('products').delete().eq('id', product.id);
      throw new AppError('PRODUCT_CREATE_FAILED', 'Không tạo được biến thể mặc định cho sản phẩm.', 500);
    }

    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.put('/:id', async (req, res, next) => {
  try {
    validateProductInput(req.body);
    const { name, short_description, description, brand, base_price, compare_at_price, category_id, is_active, is_featured } =
      req.body;
    const slug = isNonEmptyString(req.body.slug) ? slugify(req.body.slug) : slugify(name);

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        name,
        slug,
        short_description,
        description,
        brand,
        base_price,
        compare_at_price: compare_at_price || null,
        category_id: category_id || null,
        is_active: is_active ?? true,
        is_featured: is_featured ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('PRODUCT_UPDATE_FAILED', 'Không cập nhật được sản phẩm.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id);
    if (error) throw new AppError('PRODUCT_DELETE_FAILED', 'Không xoá được sản phẩm.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// --- Variants -------------------------------------------------------------
adminProductsRouter.post('/:id/variants', async (req, res, next) => {
  try {
    const { name, sku, price, stock_quantity, is_active } = req.body;
    if (!isNonEmptyString(name) || !isNonEmptyString(sku) || !Number.isFinite(Number(price))) {
      throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập đầy đủ tên, SKU và giá cho biến thể.', 400);
    }
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: req.params.id,
        name,
        sku,
        price,
        stock_quantity: stock_quantity ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();
    if (error) throw new AppError('VARIANT_CREATE_FAILED', 'Không tạo được biến thể (SKU có thể đã tồn tại).', 400);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.put('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const { name, sku, price, stock_quantity, is_active } = req.body;
    if (!isNonEmptyString(name) || !isNonEmptyString(sku) || !Number.isFinite(Number(price))) {
      throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập đầy đủ tên, SKU và giá cho biến thể.', 400);
    }
    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .update({ name, sku, price, stock_quantity: stock_quantity ?? 0, is_active: is_active ?? true, updated_at: new Date().toISOString() })
      .eq('id', req.params.variantId)
      .eq('product_id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('VARIANT_UPDATE_FAILED', 'Không cập nhật được biến thể.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.delete('/:id/variants/:variantId', async (req, res, next) => {
  try {
    const { count } = await supabaseAdmin
      .from('product_variants')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', req.params.id);
    if ((count ?? 0) <= 1) {
      throw new AppError('VARIANT_DELETE_FAILED', 'Sản phẩm phải có ít nhất 1 biến thể.', 400);
    }
    const { error } = await supabaseAdmin
      .from('product_variants')
      .delete()
      .eq('id', req.params.variantId)
      .eq('product_id', req.params.id);
    if (error) throw new AppError('VARIANT_DELETE_FAILED', 'Không xoá được biến thể.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// --- Images (URL-based for now - no file upload pipeline yet) -------------
adminProductsRouter.post('/:id/images', async (req, res, next) => {
  try {
    const { url, alt_text, is_primary } = req.body;
    if (!isNonEmptyString(url)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập URL ảnh.', 400);

    if (is_primary) {
      await supabaseAdmin.from('product_images').update({ is_primary: false }).eq('product_id', req.params.id);
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .insert({ product_id: req.params.id, url, alt_text, is_primary: !!is_primary })
      .select()
      .single();
    if (error) throw new AppError('IMAGE_CREATE_FAILED', 'Không thêm được ảnh.', 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminProductsRouter.delete('/:id/images/:imageId', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('id', req.params.imageId)
      .eq('product_id', req.params.id);
    if (error) throw new AppError('IMAGE_DELETE_FAILED', 'Không xoá được ảnh.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
