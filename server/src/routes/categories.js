import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { AppError } from '../lib/AppError.js';

export const categoriesRouter = Router();

// GET /api/categories - full active parent/child tree for the mega menu.
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic
      .from('categories')
      .select('id, parent_id, name, slug, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new AppError('CATEGORIES_FETCH_FAILED', 'Không tải được danh mục.', 500);

    const byId = new Map(data.map((c) => [c.id, { ...c, children: [] }]));
    const roots = [];
    for (const category of byId.values()) {
      if (category.parent_id && byId.has(category.parent_id)) {
        byId.get(category.parent_id).children.push(category);
      } else {
        roots.push(category);
      }
    }

    res.json({ data: roots });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug - category detail + active product count.
categoriesRouter.get('/:slug', async (req, res, next) => {
  try {
    const { data: category, error } = await supabasePublic
      .from('categories')
      .select('id, parent_id, name, slug, description, image_url')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .single();

    if (error || !category) {
      throw new AppError('NOT_FOUND', 'Không tìm thấy danh mục này.', 404);
    }

    const { count } = await supabasePublic
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category.id)
      .eq('is_active', true);

    res.json({ data: { ...category, product_count: count ?? 0 } });
  } catch (err) {
    next(err);
  }
});
