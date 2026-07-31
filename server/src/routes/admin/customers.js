import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminCustomersRouter = Router();
adminCustomersRouter.use(requireAuth, requireAdmin);

// profiles has no email column (that lives in auth.users, not exposed via
// PostgREST) - fetch it per-row via the Auth Admin API and merge in.
async function withEmail(profile) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  return { ...profile, email: error ? null : data.user?.email || null };
}

adminCustomersRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.role) query = query.eq('role', req.query.role);

    const { data, error, count } = await query;
    if (error) throw new AppError('CUSTOMERS_FETCH_FAILED', 'Không tải được danh sách khách hàng.', 500);

    const withEmails = await Promise.all(data.map(withEmail));
    res.json({ data: withEmails, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
  } catch (err) {
    next(err);
  }
});

adminCustomersRouter.get('/:id', async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .eq('id', req.params.id)
      .single();
    if (error || !profile) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng này.', 404);

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, total_amount, created_at')
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false });

    res.json({ data: { ...(await withEmail(profile)), orders: orders || [] } });
  } catch (err) {
    next(err);
  }
});

adminCustomersRouter.patch('/:id', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['customer', 'staff', 'admin'].includes(role)) {
      throw new AppError('VALIDATION_ERROR', 'Vai trò không hợp lệ.', 400);
    }

    const { data: target, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !target) throw new AppError('NOT_FOUND', 'Không tìm thấy khách hàng này.', 404);

    // Guard against demoting the last remaining admin - would lock everyone
    // out of the admin panel with no self-service way back in.
    if (target.role === 'admin' && role !== 'admin') {
      const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
      if ((count ?? 0) <= 1) {
        throw new AppError('LAST_ADMIN', 'Không thể hạ quyền admin cuối cùng trong hệ thống.', 400);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, full_name, phone, role')
      .single();
    if (error) throw new AppError('CUSTOMER_UPDATE_FAILED', 'Không cập nhật được vai trò.', 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
