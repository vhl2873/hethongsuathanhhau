import { escapeHtml } from './format.js';

// Shared blog card, used by the home page rail and the blog listing.
export function formatPostDate(isoString) {
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderPostCard(post) {
  const cover = post.cover_image_url
    ? `<img src="${escapeHtml(post.cover_image_url)}" alt="${escapeHtml(post.title)}" width="400" height="240" loading="lazy" />`
    : 'ẢNH BÀI VIẾT';

  return `
    <a class="post-card" href="./blog-details.html?slug=${encodeURIComponent(post.slug)}">
      <span class="post-card__media">${cover}</span>
      <span class="post-card__body">
        <span class="post-card__date">${formatPostDate(post.published_at)}</span>
        <span class="post-card__title">${escapeHtml(post.title)}</span>
        ${post.excerpt ? `<span class="post-card__excerpt">${escapeHtml(post.excerpt)}</span>` : ''}
      </span>
    </a>`;
}
