import { api } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';
import { renderPagination } from '../lib/pagination.js';

let currentPage = 1;
const grid = document.querySelector('[data-blog-grid]');
const paginationEl = document.querySelector('[data-pagination]');

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderPostCard(post) {
  const cover = post.cover_image_url
    ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" width="400" height="240" loading="lazy" />`
    : `<div class="blog-card__no-image">Chưa có ảnh</div>`;

  return `
    <a class="card blog-card" href="./blog-details.html?slug=${encodeURIComponent(post.slug)}">
      <div class="blog-card__image">${cover}</div>
      <p class="blog-card__date">${formatDate(post.published_at)}</p>
      <h3 class="blog-card__title">${escapeHtml(post.title)}</h3>
      ${post.excerpt ? `<p class="blog-card__excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
    </a>`;
}

async function loadPosts() {
  grid.innerHTML = `
    <div class="skeleton blog-card-skeleton"></div>
    <div class="skeleton blog-card-skeleton"></div>
    <div class="skeleton blog-card-skeleton"></div>`;

  try {
    const { data: posts, pagination } = await api.get(`/api/posts?page=${currentPage}`, { raw: true });

    if (!posts.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Chưa có bài viết nào</p>
          <p>Vui lòng quay lại sau.</p>
        </div>`;
      paginationEl.innerHTML = '';
      return;
    }

    grid.innerHTML = posts.map(renderPostCard).join('');
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

loadPosts();
