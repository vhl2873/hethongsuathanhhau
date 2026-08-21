import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { AppError } from '../lib/AppError.js';

export const bannersRouter = Router();

// GET /api/banners?position=home_hero - active banners for a slot, in
// display order. Used by the home hero carousel and any other banner slot;
// `position` is required so a page never accidentally renders every banner
// in the table.
bannersRouter.get('/', async (req, res, next) => {
  try {
    const { position } = req.query;
    if (!position) throw new AppError('VALIDATION_ERROR', 'Thiếu tham số position.', 400);

    const now = new Date().toISOString();
    const { data, error } = await supabasePublic
      .from('banners')
      .select('id, title, eyebrow, subtitle, image_url, link_url, cta_label, secondary_cta_label, secondary_cta_url, position, sort_order')
      .eq('position', position)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true });

    if (error) throw new AppError('BANNERS_FETCH_FAILED', 'Không tải được banner.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
