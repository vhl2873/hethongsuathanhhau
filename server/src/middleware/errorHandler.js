import { AppError } from '../lib/AppError.js';

const DEFAULT_MESSAGE = 'Đã có lỗi xảy ra, vui lòng thử lại sau.';

// Central error formatter mounted last in server.js. Recognizes AppError
// (thrown deliberately by routes/services) and returns its status/message
// as-is; anything else is logged and returned as a generic 500 so internal
// details never leak to the client.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File ảnh vượt quá dung lượng cho phép (tối đa 5MB).' : 'Không tải file lên được.';
    return res.status(400).json({ error: { code: err.code, message } });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: DEFAULT_MESSAGE },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn API này.' },
  });
}
