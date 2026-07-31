import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';

// Must run after requireAuth. Looks up profiles.role for req.user.id via
// the service-role client and rejects anyone who isn't admin/staff. Every
// /api/admin/** route must go through this before touching supabaseAdmin
// for anything else.
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Bạn cần đăng nhập để thực hiện thao tác này.', 401);
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || !['admin', 'staff'].includes(profile.role)) {
      throw new AppError('FORBIDDEN', 'Tài khoản của bạn không có quyền truy cập trang quản trị.', 403);
    }

    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}
