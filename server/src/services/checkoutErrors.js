import { AppError } from '../lib/AppError.js';

// Translates the error codes raised by checkout_create_order (see
// server/supabase/schema.sql) into AppError. Kept dependency-free (no
// Supabase client import) so it can be unit tested without live credentials.
export function mapCheckoutError(error) {
  const message = error?.message || '';

  if (message.startsWith('INSUFFICIENT_STOCK:')) {
    const sku = message.split(':')[1];
    return new AppError(
      'INSUFFICIENT_STOCK',
      `Sản phẩm (SKU: ${sku}) không đủ số lượng trong kho.`,
      409,
      { sku },
    );
  }
  if (message.startsWith('VARIANT_NOT_FOUND:')) {
    const variantId = message.split(':')[1];
    return new AppError(
      'VARIANT_NOT_FOUND',
      'Một sản phẩm trong giỏ hàng không còn tồn tại.',
      404,
      { variantId },
    );
  }
  if (message.startsWith('EMPTY_CART')) {
    return new AppError('EMPTY_CART', 'Giỏ hàng đang trống.', 400);
  }
  if (message.startsWith('INVALID_QUANTITY')) {
    return new AppError('INVALID_QUANTITY', 'Số lượng sản phẩm không hợp lệ.', 400);
  }
  if (message.startsWith('INVALID_SHIPPING_METHOD')) {
    return new AppError('INVALID_SHIPPING_METHOD', 'Phương thức vận chuyển không hợp lệ.', 400);
  }

  return new AppError('CHECKOUT_FAILED', 'Không thể tạo đơn hàng, vui lòng thử lại.', 500);
}
