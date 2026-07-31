import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminReviewsRouter = Router();
adminReviewsRouter.use(requireAuth, requireAdmin);

adminReviewsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('reviews')
      .select('id, rating, title, content, is_approved, created_at, product:products(id, name, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status === 'pending') query = query.eq('is_approved', false);
    if (req.query.status === 'approved') query = query.eq('is_approved', true);

    const { data, error, count } = await query;
    if (error) throw new AppError('REVIEWS_FETCH_FAILED', 'Không tải được đánh giá.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminReviewsRouter.patch('/:id/approve', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ is_approved: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) throw new AppError('REVIEW_APPROVE_FAILED', 'Không duyệt được đánh giá này.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminReviewsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', req.params.id);
    if (error) throw new AppError('REVIEW_DELETE_FAILED', 'Không xoá được đánh giá.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
