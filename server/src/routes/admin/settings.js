import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAuth, requireAdmin);

// Never expose/allow editing internal-only keys (initial_admin_email) here,
// even though this route already sits behind requireAdmin - keeps the
// admin settings screen from ever accidentally overwriting it with junk.
const EDITABLE_KEYS = [
  'store_name',
  'store_address',
  'store_phone',
  'store_hotline',
  'store_email',
  'opening_hours',
  'social_links',
  'logo_url',
];

adminSettingsRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('app_settings').select('key, value').in('key', EDITABLE_KEYS);
    if (error) throw new AppError('SETTINGS_FETCH_FAILED', 'Không tải được cài đặt cửa hàng.', 500);
    res.json({ data: Object.fromEntries(data.map((row) => [row.key, row.value])) });
  } catch (err) {
    next(err);
  }
});

adminSettingsRouter.put('/', async (req, res, next) => {
  try {
    const rows = EDITABLE_KEYS.filter((key) => key in req.body).map((key) => ({
      key,
      value: req.body[key],
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) throw new AppError('VALIDATION_ERROR', 'Không có dữ liệu để cập nhật.', 400);

    const { error } = await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) throw new AppError('SETTINGS_UPDATE_FAILED', 'Không lưu được cài đặt cửa hàng.', 500);

    const { data } = await supabaseAdmin.from('app_settings').select('key, value').in('key', EDITABLE_KEYS);
    res.json({ data: Object.fromEntries(data.map((row) => [row.key, row.value])) });
  } catch (err) {
    next(err);
  }
});
