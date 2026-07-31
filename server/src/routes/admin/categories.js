import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';
import { slugify } from '../../lib/slugify.js';

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAuth, requireAdmin);

adminCategoriesRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, parent_id, name, slug, description, image_url, sort_order, is_active')
      .order('sort_order', { ascending: true });
    if (error) throw new AppError('CATEGORIES_FETCH_FAILED', 'Không tải được danh mục.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validateCategoryInput(body) {
  if (!isNonEmptyString(body.name)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập tên danh mục.', 400);
}

adminCategoriesRouter.post('/', async (req, res, next) => {
  try {
    validateCategoryInput(req.body);
    const { name, description, image_url, parent_id, sort_order, is_active } = req.body;
    const slug = isNonEmptyString(req.body.slug) ? slugify(req.body.slug) : slugify(name);

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name,
        slug,
        description,
        image_url,
        parent_id: parent_id || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();
    if (error) throw new AppError('CATEGORY_CREATE_FAILED', 'Không tạo được danh mục (slug có thể đã tồn tại).', 400);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.put('/:id', async (req, res, next) => {
  try {
    validateCategoryInput(req.body);
    const { name, description, image_url, parent_id, sort_order, is_active } = req.body;
    const slug = isNonEmptyString(req.body.slug) ? slugify(req.body.slug) : slugify(name);

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({
        name,
        slug,
        description,
        image_url,
        parent_id: parent_id || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('CATEGORY_UPDATE_FAILED', 'Không cập nhật được danh mục.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('categories').delete().eq('id', req.params.id);
    if (error) throw new AppError('CATEGORY_DELETE_FAILED', 'Không xoá được danh mục.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
