import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { AppError } from '../../lib/AppError.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

export const adminStorageRouter = Router();
adminStorageRouter.use(requireAuth, requireAdmin);

const BUCKET = 'product-images';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
  },
});

// POST /api/admin/storage/upload - multipart/form-data, field name "file".
// Uploads directly to Supabase Storage using the service-role key (never
// exposed to the browser) - admin-only, gated by requireAdmin above.
adminStorageRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'Vui lòng chọn 1 file ảnh (jpg, png, webp hoặc gif, tối đa 5MB).', 400);
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw new AppError('UPLOAD_FAILED', 'Không tải ảnh lên được, vui lòng thử lại.', 500);

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    res.status(201).json({ data: { url: publicUrlData.publicUrl } });
  } catch (err) {
    next(err);
  }
});
