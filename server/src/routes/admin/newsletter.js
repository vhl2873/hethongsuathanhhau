import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminNewsletterRouter = Router();
adminNewsletterRouter.use(requireAuth, requireAdmin);

// No pagination - admins typically want the full list for CSV export
// client-side; subscriber counts are small enough for a v1 store.
adminNewsletterRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false });
    if (error) throw new AppError('NEWSLETTER_FETCH_FAILED', 'Không tải được danh sách đăng ký nhận tin.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
