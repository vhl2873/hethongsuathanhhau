import { api } from '../lib/api.js';
import { observeReveal } from '../lib/reveal.js';
import { escapeHtml, formatCurrency } from '../lib/format.js';
import { initCarousel } from '../lib/carousel.js';

async function renderFeaturedProducts() {
  const grid = document.querySelector('[data-featured-grid]');
  if (!grid) return;

  try {
    const products = await api.get('/api/products?featured=true&limit=8');
    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state product-grid__empty">
          <p class="empty-state__title">Chưa có sản phẩm nổi bật</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    grid.innerHTML = products.map(renderProductCard).join('');
  } catch {
    grid.innerHTML = `
      <div class="empty-state product-grid__empty">
        <p class="empty-state__title">Không tải được sản phẩm nổi bật</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

function renderProductCard(product) {
  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" width="300" height="300" loading="lazy" />`
    : `<div class="product-card__no-image">Chưa có ảnh</div>`;

  const compareAt =
    product.compare_at_price && product.compare_at_price > product.base_price
      ? `<span class="product-card__price-compare">${formatCurrency(product.compare_at_price)}</span>`
      : '';

  return `
    <a class="card product-card" href="./product-details.html?slug=${encodeURIComponent(product.slug)}">
      <div class="product-card__image">${image}</div>
      <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
      <div class="product-card__price">
        <span class="product-card__price-current">${formatCurrency(product.base_price)}</span>
        ${compareAt}
      </div>
    </a>`;
}

async function renderHomeBlogPosts() {
  const grid = document.querySelector('[data-home-blog-grid]');
  if (!grid) return;

  try {
    const posts = await api.get('/api/posts?limit=3');
    if (!posts.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có bài viết nào</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    grid.innerHTML = posts.map(renderPostCard).join('');
  } catch {
    grid.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được bài viết</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

function formatPostDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderPostCard(post) {
  const cover = post.cover_image_url
    ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" width="400" height="240" loading="lazy" />`
    : `<div class="blog-card__no-image">Chưa có ảnh</div>`;

  return `
    <a class="card blog-card" href="./blog-details.html?slug=${encodeURIComponent(post.slug)}">
      <div class="blog-card__image">${cover}</div>
      <p class="blog-card__date">${formatPostDate(post.published_at)}</p>
      <h3 class="blog-card__title">${escapeHtml(post.title)}</h3>
      ${post.excerpt ? `<p class="blog-card__excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
    </a>`;
}

renderFeaturedProducts();
renderHomeBlogPosts();
observeReveal();

const carouselRoot = document.querySelector('[data-carousel]');
if (carouselRoot) initCarousel(carouselRoot);
