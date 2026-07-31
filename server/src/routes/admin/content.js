import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { isNonEmptyString } from '../../lib/validators.js';
import { slugify } from '../../lib/slugify.js';

// Blog posts only - about/faq/privacy-policy are static HTML with no DB
// backing (decided during planning), so there is no "pages" CRUD here.
export const adminContentRouter = Router();
adminContentRouter.use(requireAuth, requireAdmin);

adminContentRouter.get('/posts', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('posts')
      .select('id, title, slug, is_published, published_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new AppError('POSTS_FETCH_FAILED', 'Không tải được bài viết.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminContentRouter.get('/posts/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('posts').select('*').eq('id', req.params.id).single();
    if (error || !data) throw new AppError('NOT_FOUND', 'Không tìm thấy bài viết này.', 404);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

function validatePostInput(body) {
  if (!isNonEmptyString(body.title)) throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập tiêu đề bài viết.', 400);
}

function postPayload(body, req) {
  const isPublished = body.is_published ?? false;
  return {
    title: body.title,
    slug: isNonEmptyString(body.slug) ? slugify(body.slug) : slugify(body.title),
    excerpt: body.excerpt || null,
    content: body.content || null,
    cover_image_url: body.cover_image_url || null,
    meta_title: body.meta_title || null,
    meta_description: body.meta_description || null,
    is_published: isPublished,
    published_at: isPublished ? body.published_at || new Date().toISOString() : null,
    author_id: req.user.id,
  };
}

adminContentRouter.post('/posts', async (req, res, next) => {
  try {
    validatePostInput(req.body);
    const { data, error } = await supabaseAdmin.from('posts').insert(postPayload(req.body, req)).select().single();
    if (error) throw new AppError('POST_CREATE_FAILED', 'Không tạo được bài viết (slug có thể đã tồn tại).', 400);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

adminContentRouter.put('/posts/:id', async (req, res, next) => {
  try {
    validatePostInput(req.body);
    const payload = postPayload(req.body, req);
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('posts').update(payload).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError('POST_UPDATE_FAILED', 'Không cập nhật được bài viết.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

adminContentRouter.delete('/posts/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('posts').delete().eq('id', req.params.id);
    if (error) throw new AppError('POST_DELETE_FAILED', 'Không xoá được bài viết.', 500);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
