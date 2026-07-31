import { supabasePublic } from '../lib/supabasePublic.js';
import { AppError } from '../lib/AppError.js';

// Verifies the Supabase JWT sent by the frontend (which authenticated
// directly against Supabase Auth) and attaches req.user = { id, email }.
// Does NOT touch the profiles table - that's requireAdmin's job when a
// role check is actually needed.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('UNAUTHORIZED', 'Bạn cần đăng nhập để thực hiện thao tác này.', 401);
    }

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) {
      throw new AppError('UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401);
    }

    req.user = { id: data.user.id, email: data.user.email };
    next();
  } catch (err) {
    next(err);
  }
}

// Attaches req.user if a valid Bearer token is present, but never rejects
// the request - for routes like POST /api/checkout that support both
// guest and logged-in flows.
export async function attachUserIfPresent(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      const { data } = await supabasePublic.auth.getUser(token);
      if (data?.user) {
        req.user = { id: data.user.id, email: data.user.email };
      }
    }
    next();
  } catch {
    next();
  }
}
