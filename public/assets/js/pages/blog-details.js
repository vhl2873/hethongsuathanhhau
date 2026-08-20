import { api, ApiError } from '../lib/api.js';
import { escapeHtml } from '../lib/format.js';
import { sanitizeHtml } from '../lib/sanitize-html.js';
import { renderPostCard, formatPostDate } from '../lib/post-card.js';

const root = document.querySelector('[data-post-root]');
const slug = new URLSearchParams(window.location.search).get('slug');

async function init() {
  if (!slug) {
    renderNotFound();
    return;
  }

  try {
    const post = await api.get(`/api/posts/${encodeURIComponent(slug)}`);
    document.title = `${post.meta_title || post.title} - Siêu Thị Sữa Thanh Hậu`;

    root.innerHTML = `
      <article class="post-detail">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="./index.html">Trang chủ</a> / <a href="./blog.html">Tin tức</a> / <span>${escapeHtml(post.title)}</span>
        </nav>
        ${post.cover_image_url ? `<img class="post-detail__cover" src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" />` : ''}
        <h1 class="post-detail__title">${escapeHtml(post.title)}</h1>
        <p class="post-detail__date">${formatPostDate(post.published_at)}</p>
        <div class="post-detail__content">${sanitizeHtml(post.content || '')}</div>
        <p class="post-detail__foot">
          <a class="btn btn--outline" href="./blog.html">&larr; Quay lại danh sách tin tức</a>
        </p>
      </article>

      <section class="post-more" data-more-posts hidden>
        <div class="section-head">
          <h2 class="section-head__title">Bài viết khác</h2>
          <a class="section-head__more" href="./blog.html">Xem tất cả &rarr;</a>
        </div>
        <div class="post-grid" data-more-grid></div>
      </section>`;

    loadMorePosts();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      renderNotFound();
    } else {
      root.innerHTML = `
        <div class="post-detail empty-state">
          <p class="empty-state__title">Không tải được bài viết</p>
          <p>Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại sau.</p>
        </div>`;
    }
  }
}

// Three other published posts, so a reader who finishes an article has
// somewhere to go that isn't the browser Back button.
async function loadMorePosts() {
  const section = root.querySelector('[data-more-posts]');
  const grid = root.querySelector('[data-more-grid]');
  if (!section || !grid) return;

  try {
    const posts = await api.get('/api/posts?limit=4');
    const others = posts.filter((post) => post.slug !== slug).slice(0, 3);
    if (!others.length) return;
    grid.innerHTML = others.map(renderPostCard).join('');
    section.hidden = false;
  } catch {
    // Leave hidden.
  }
}

function renderNotFound() {
  root.innerHTML = `
    <div class="post-detail empty-state">
      <p class="empty-state__title">Không tìm thấy bài viết</p>
      <p><a class="btn btn--primary" href="./blog.html">Quay lại danh sách tin tức</a></p>
    </div>`;
}

init();
