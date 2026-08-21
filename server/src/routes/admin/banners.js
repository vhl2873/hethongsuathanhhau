import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';

export const adminBannersRouter = Router();
adminBannersRouter.use(requireAuth, requireAdmin);

adminBannersRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('banners').select('*').order('sort_order', { ascending: true });
    if (error) throw new AppError('BANNERS_FETCH_FAILED', 'Không tải được banner.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validateBannerInput(body) {
  if (!isNonEmptyString(body.image_url)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập URL ảnh banner.', 400);
  if (!isNonEmptyString(body.position)) throw new AppError('VALIDATION_ERROR', 'Vui lòng chọn vị trí hiển thị.', 400);
}

function bannerPayload(body) {
  return {
    title: body.title || null,
    eyebrow: body.eyebrow || null,
    subtitle: body.subtitle || null,
    image_url: body.image_url,
    link_url: body.link_url || null,
    cta_label: body.cta_label || null,
    secondary_cta_label: body.secondary_cta_label || null,
    secondary_cta_url: body.secondary_cta_url || null,
    position: body.position,
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active ?? true,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
  };
}

adminBannersRouter.post('/', async (req, res, next) => {
  try {
    validateBannerInput(req.body);
    const { data, error } = await supabaseAdmin.from('banners').insert(bannerPayload(req.body)).select().single();
    if (error) throw new AppError('BANNER_CREATE_FAILED', 'Không tạo được banner.', 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminBannersRouter.put('/:id', async (req, res, next) => {
  try {
    validateBannerInput(req.body);
    const { data, error } = await supabaseAdmin
      .from('banners')
      .update(bannerPayload(req.body))
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('BANNER_UPDATE_FAILED', 'Không cập nhật được banner.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminBannersRouter.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('banners').delete().eq('id', req.params.id);
    if (error) throw new AppError('BANNER_DELETE_FAILED', 'Không xoá được banner.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
