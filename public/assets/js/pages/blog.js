import { api } from '../lib/api.js';
import { escapeHtml, formatCurrency } from '../lib/format.js';
import { renderPagination } from '../lib/pagination.js';
import { renderPostCard, formatPostDate } from '../lib/post-card.js';

let currentPage = 1;
const grid = document.querySelector('[data-blog-grid]');
const paginationEl = document.querySelector('[data-pagination]');
const featuredEl = document.querySelector('[data-featured-post]');

// The newest post gets the wide treatment at the top of page one; on later
// pages there is no featured slot so the grid keeps every post.
function renderFeatured(post) {
  if (!featuredEl) return;
  const cover = post.cover_image_url
    ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" width="600" height="450" />`
    : 'ẢNH BÀI VIẾT';

  featuredEl.innerHTML = `
    <div class="blog-hero__media">${cover}</div>
    <div>
      <span class="blog-hero__badge">Bài mới nhất</span>
      <span class="blog-hero__date">${formatPostDate(post.published_at)}</span>
      <h2 class="blog-hero__title">${escapeHtml(post.title)}</h2>
      ${post.excerpt ? `<p class="blog-hero__excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
      <a class="btn btn--primary" href="./blog-details.html?slug=${encodeURIComponent(post.slug)}">Đọc bài viết</a>
    </div>`;
  featuredEl.hidden = false;
}

async function loadPosts() {
  grid.innerHTML = `
    <div class="skeleton post-card-skeleton"></div>
    <div class="skeleton post-card-skeleton"></div>
    <div class="skeleton post-card-skeleton"></div>`;

  try {
    const { data: posts, pagination } = await api.get(`/api/posts?page=${currentPage}`, { raw: true });

    if (!posts.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có bài viết nào</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      paginationEl.innerHTML = '';
      if (featuredEl) featuredEl.hidden = true;
      return;
    }

    let rest = posts;
    if (currentPage === 1) {
      renderFeatured(posts[0]);
      rest = posts.slice(1);
    } else if (featuredEl) {
      featuredEl.hidden = true;
    }

    grid.innerHTML = rest.length
      ? rest.map(renderPostCard).join('')
      : '<p class="empty-state">Chỉ có một bài viết ở trang này.</p>';

    renderPagination(paginationEl, pagination, (page) => {
      currentPage = page;
      loadPosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch {
    grid.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__title">Không tải được bài viết</p>
        <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
      </div>`;
  }
}

// Product rail beside the articles - featured products, so a reader can go
// straight from advice to something they can buy.
async function loadRelatedProducts() {
  const panel = document.querySelector('[data-related-products-panel]');
  const list = document.querySelector('[data-related-products]');
  if (!panel || !list) return;

  try {
    const products = await api.get('/api/products?featured=true&limit=4');
    if (!products.length) return;
    list.innerHTML = products
      .map(
        (product) => `
        <a class="blog-product" href="./product-details.html?slug=${encodeURIComponent(product.slug)}">
          <span class="blog-product__image">
            ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="" loading="lazy" />` : ''}
          </span>
          <span>
            <span class="blog-product__name">${escapeHtml(product.name)}</span>
            <span class="blog-product__price">${formatCurrency(product.base_price)}</span>
          </span>
        </a>`,
      )
      .join('');
    panel.hidden = false;
  } catch {
    // Leave hidden.
  }
}

loadPosts();
loadRelatedProducts();
