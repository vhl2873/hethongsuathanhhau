import { api } from '../lib/api.js';
import { renderProductCard, renderCardSkeletons, discountPercent } from '../lib/product-card.js';
import { renderVoucherCard, wireCopyButtons } from '../lib/coupon.js';

// Both blocks on this page are driven by live shop data: the coupon list
// comes from /api/coupons, and "đang giảm giá" is worked out by comparing
// each product's price with its own compare-at price. When there is nothing
// on offer the page says so instead of inventing a campaign.
async function renderCoupons() {
  const grid = document.querySelector('[data-voucher-grid]');
  if (!grid) return;

  try {
    const coupons = await api.get('/api/coupons?limit=12');
    if (!coupons.length) {
      grid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Hiện chưa có mã giảm giá nào</p>
          <p>Bạn có thể đăng ký nhận thông báo ở cuối trang để biết khi có mã mới.</p>
        </div>`;
      return;
    }
    grid.innerHTML = coupons.map(renderVoucherCard).join('');
    wireCopyButtons(grid);
  } catch {
    grid.innerHTML = `
      <div class="empty-state product-grid__empty">
        <p class="empty-state__title">Không tải được mã giảm giá</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

async function renderDeals() {
  const grid = document.querySelector('[data-deals-grid]');
  if (!grid) return;
  grid.innerHTML = renderCardSkeletons(5);

  try {
    const products = await api.get('/api/products?limit=48');
    const discounted = products
      .filter((product) => discountPercent(product) > 0)
      .sort((a, b) => discountPercent(b) - discountPercent(a))
      .slice(0, 10);

    if (!discounted.length) {
      grid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Hiện chưa có sản phẩm nào đang giảm giá</p>
          <p>Ghé lại sau nhé, hoặc xem toàn bộ sản phẩm trong cửa hàng.</p>
        </div>`;
      return;
    }
    grid.innerHTML = discounted.map(renderProductCard).join('');
  } catch {
    grid.innerHTML = `
      <div class="empty-state product-grid__empty">
        <p class="empty-state__title">Không tải được sản phẩm</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

// Hero artwork: a real product from the shop rather than stock imagery.
async function renderHeroImage() {
  const holder = document.querySelector('[data-hero-image]');
  if (!holder) return;

  try {
    const products = await api.get('/api/products?featured=true&limit=1');
    const image = products[0]?.image_url;
    if (!image) return;
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    holder.append(img);
  } catch {
    // Hero stays a plain gradient.
  }
}

renderCoupons();
renderDeals();
renderHeroImage();
