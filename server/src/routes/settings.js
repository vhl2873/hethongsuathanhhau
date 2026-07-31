import { Router } from 'express';
import { supabasePublic } from '../lib/supabasePublic.js';
import { AppError } from '../lib/AppError.js';

export const settingsRouter = Router();

// Whitelist: never leak internal-only keys like initial_admin_email even
// though app_settings' RLS policy allows public reads on the whole table.
const PUBLIC_SETTING_KEYS = [
  'store_name',
  'store_address',
  'store_phone',
  'store_hotline',
  'store_email',
  'opening_hours',
  'social_links',
  'logo_url',
];

// GET /api/settings - store info for header/footer.
settingsRouter.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabasePublic
      .from('app_settings')
      .select('key, value')
      .in('key', PUBLIC_SETTING_KEYS);

    if (error) throw new AppError('SETTINGS_FETCH_FAILED', 'Không tải được thông tin cửa hàng.', 500);

    const settings = Object.fromEntries(data.map((row) => [row.key, row.value]));
    res.json({ data: settings });
  } catch (err) {
    next(err);
  }
});
