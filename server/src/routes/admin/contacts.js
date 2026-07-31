import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminContactsRouter = Router();
adminContactsRouter.use(requireAuth, requireAdmin);

adminContactsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error, count } = await query;
    if (error) throw new AppError('CONTACTS_FETCH_FAILED', 'Không tải được danh sách liên hệ.', 500);
    res.json({ data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminContactsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['new', 'read', 'replied'].includes(status)) {
      throw new AppError('VALIDATION_ERROR', 'Trạng thái không hợp lệ.', 400);
    }
    const { data, error } = await supabaseAdmin.from('contacts').update({ status }).eq('id', req.params.id).select().single();
    if (error || !data) throw new AppError('CONTACT_UPDATE_FAILED', 'Không cập nhật được liên hệ.', 400);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
