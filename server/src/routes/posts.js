import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { AppError } from '../lib/AppError.js';

export const postsRouter = Router();

// GET /api/posts?page=&limit= - published posts only (enforced by RLS too).
postsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabasePublic
      .from('posts')
      .select('id, title, slug, excerpt, cover_image_url, published_at', { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (error) throw new AppError('POSTS_FETCH_FAILED', 'Không tải được bài viết.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

postsRouter.get('/:slug', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic
      .from('posts')
      .select('id, title, slug, excerpt, content, cover_image_url, published_at, meta_title, meta_description')
      .eq('slug', req.params.slug)
      .eq('is_published', true)
      .single();

    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy bài viết này.', 404);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
