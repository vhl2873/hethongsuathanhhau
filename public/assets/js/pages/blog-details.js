import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-post-root]');
const slug = new URLSearchParams(window.location.search).get('slug');

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function init() {
  if (!slug) {
    renderNotFound();
    return;
  }

  try {
    const post = await api.get(`/api/posts/${encodeURIComponent(slug)}`);
    document.title = `${post.meta_title || post.title} - Siêu thị sữa Thành Hậu`;

    root.innerHTML = `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="./index.html">Trang chủ</a> / <a href="./blog.html">Tin tức</a> / <span>${escapeHtml(post.title)}</span>
      </nav>
      ${post.cover_image_url ? `<img class="post-detail__cover" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" />` : ''}
      <h1 class="post-detail__title">${escapeHtml(post.title)}</h1>
      <p class="post-detail__date">${formatDate(post.published_at)}</p>
      <div class="post-detail__content">${escapeHtml(post.content || '')}</div>
      <a class="btn btn--outline" href="./blog.html">&larr; Quay lại danh sách tin tức</a>
    `;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      renderNotFound();
    } else {
      root.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Không tải được bài viết</p>
          <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
        </div>`;
    }
  }
}

function renderNotFound() {
  root.innerHTML = `
    <div class="empty-state">
      <p class="empty-state__title">Không tìm thấy bài viết</p>
      <a class="btn btn--primary" href="./blog.html">Quay lại danh sách tin tức</a>
    </div>`;
}

init();
