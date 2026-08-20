import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateReviewInput } from '../lib/validators.js';

export const productsRouter = Router();

const SORT_MAP = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'base_price', ascending: true },
  price_desc: { column: 'base_price', ascending: false },
  name_asc: { column: 'name', ascending: true },
};

function formatProductSummary(row) {
  const images = row.product_images || [];
  const primaryImage = images.find((img) => img.is_primary) || images[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    base_price: row.base_price,
    compare_at_price: row.compare_at_price,
    is_featured: row.is_featured,
    category: row.category,
    image_url: primaryImage?.url || null,
  };
}

// GET /api/products?category=&search=&sort=&page=&limit=
productsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sort = SORT_MAP[req.query.sort] || SORT_MAP.newest;

    let categoryId = null;
    if (req.query.category) {
      const { data: category } = await supabasePublic
        .from('categories')
        .select('id')
        .eq('slug', req.query.category)
        .single();
      if (!category) {
        return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      categoryId = category.id;
    }

    let query = supabasePublic
      .from('products')
      .select(
        'id, name, slug, brand, base_price, compare_at_price, is_featured, category:categories(name, slug), product_images(url, is_primary)',
        { count: 'exact' },
      )
      .order(sort.column, { ascending: sort.ascending })
      .range(from, to);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
    if (req.query.featured === 'true') query = query.eq('is_featured', true);

    // Shop-page facets. Brands come as a comma-separated list so several can
    // be ticked at once; prices are filtered on base_price, the number the
    // card actually shows.
    const brands = String(req.query.brand || '')
      .split(',')
      .map((brand) => brand.trim())
      .filter(Boolean);
    if (brands.length) query = query.in('brand', brands);

    const minPrice = Number(req.query.minPrice);
    if (Number.isFinite(minPrice) && minPrice > 0) query = query.gte('base_price', minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(maxPrice) && maxPrice > 0) query = query.lte('base_price', maxPrice);

    const { data, error, count } = await query;
    if (error) throw new AppError('PRODUCTS_FETCH_FAILED', 'Không tải được danh sách sản phẩm.', 500);

    res.json({
      data: data.map(formatProductSummary),
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/brands - brand facet for the shop sidebar, with the
// number of active products per brand so the sidebar never offers a filter
// that would return nothing. Registered before /:slug so "brands" is not
// mistaken for a product slug.
productsRouter.get('/brands', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic.from('products').select('brand').not('brand', 'is', null);
    if (error) throw new AppError('BRANDS_FETCH_FAILED', 'Không tải được danh sách thương hiệu.', 500);

    const counts = new Map();
    for (const row of data) {
      const brand = (row.brand || '').trim();
      if (!brand) continue;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    }

    const brands = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

    res.json({ data: brands });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug/reviews - approved reviews only (enforced by RLS too).
productsRouter.get('/:slug/reviews', async (req, res, next) => {
  try {
    const { data: product } = await supabasePublic.from('products').select('id').eq('slug', req.params.slug).single();
    if (!product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm này.', 404);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabasePublic
      .from('reviews')
      .select('id, rating, title, content, created_at', { count: 'exact' })
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new AppError('REVIEWS_FETCH_FAILED', 'Không tải được đánh giá.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:slug/reviews - is_approved defaults to false; moderated in Phase 4 admin.
productsRouter.post('/:slug/reviews', requireAuth, async (req, res, next) => {
  try {
    const rating = Number.parseInt(req.body.rating, 10);
    const { title, content } = req.body;
    const errors = validateReviewInput({ rating, title, content });
    if (errors.length) throw new AppError('VALIDATION_ERROR', errors[0], 400, { errors });

    const { data: product } = await supabasePublic.from('products').select('id').eq('slug', req.params.slug).single();
    if (!product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm này.', 404);

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({ product_id: product.id, user_id: req.user.id, rating, title, content, is_approved: false })
      .select()
      .single();
    if (error) throw new AppError('REVIEW_CREATE_FAILED', 'Không thể gửi đánh giá, vui lòng thử lại.', 500);

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug - full detail for the product page.
productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { data: product, error } = await supabasePublic
      .from('products')
      .select(
        `id, name, slug, short_description, description, brand, base_price, compare_at_price,
         meta_title, meta_description,
         category:categories(id, name, slug),
         product_images(url, alt_text, sort_order, is_primary),
         product_variants(id, name, sku, price, stock_quantity, is_active)`,
      )
      .eq('slug', req.params.slug)
      .single();

    if (error || !product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm này.', 404);

    product.product_images = [...(product.product_images || [])].sort((a, b) => a.sort_order - b.sort_order);
    product.product_variants = (product.product_variants || []).filter((v) => v.is_active);

    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});
