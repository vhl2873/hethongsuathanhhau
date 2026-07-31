import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;

const root = document.querySelector('[data-content-root]');

async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Bài viết</h1>
      <a class="btn btn--primary" href="./content.html?id=new">+ Viết bài mới</a>
    </div>
    <div data-table></div>
    <div class="pagination" data-pagination></div>`;

  await loadList();
}

async function loadList() {
  const tableEl = root.querySelector('[data-table]');
  tableEl.innerHTML = '<div class="skeleton" style="height:240px;border-radius:16px"></div>';

  try {
    const { data: posts, pagination } = await api.get(`/api/admin/content/posts?page=${currentPage}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: posts,
      getRowId: (p) => p.id,
      emptyMessage: 'Chưa có bài viết nào.',
      columns: [
        { label: 'Tiêu đề', render: (p) => escapeHtml(p.title) },
        { key: 'slug', label: 'Slug' },
        {
          label: 'Trạng thái',
          render: (p) => (p.is_published ? '<span class="badge badge--success">Đã đăng</span>' : '<span class="badge badge--warning">Nháp</span>'),
        },
        { label: 'Ngày tạo', render: (p) => new Date(p.created_at).toLocaleDateString('vi-VN') },
      ],
      rowActions: (p) => `
        <a class="btn btn--outline" href="./content.html?id=${p.id}">Sửa</a>
        <button type="button" class="btn btn--danger" data-delete="${p.id}">Xoá</button>`,
    });

    tableEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.delete)));
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được bài viết</p></div>`;
  }
}

async function handleDelete(id) {
  const confirmed = await confirmDialog({ title: 'Xoá bài viết', message: 'Xoá bài viết này? Hành động này không thể hoàn tác.' });
  if (!confirmed) return;
  try {
    await api.delete(`/api/admin/content/posts/${id}`, { token });
    await loadList();
  } catch {
    window.alert('Không xoá được bài viết.');
  }
}

async function renderDetail(postId) {
  root.innerHTML = '<div class="skeleton" style="height:400px;border-radius:16px"></div>';

  let post = null;
  if (postId) {
    try {
      post = await api.get(`/api/admin/content/posts/${postId}`, { token });
    } catch {
      root.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Không tìm thấy bài viết</p>
          <a class="btn btn--primary" href="./content.html">Quay lại danh sách</a>
        </div>`;
      return;
    }
  }

  root.innerHTML = `
    <a class="admin-back-link" href="./content.html">&larr; Quay lại danh sách bài viết</a>
    <h1 class="page-title">${post ? 'Sửa bài viết' : 'Viết bài mới'}</h1>

    <div class="admin-form-panel">
      <div class="alert alert--danger" data-post-form-error hidden></div>
      <form data-post-form novalidate>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="post-title">Tiêu đề</label>
            <input class="input" id="post-title" name="title" required value="${escapeHtml(post?.title || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="post-slug">Slug (để trống để tự tạo)</label>
            <input class="input" id="post-slug" name="slug" value="${escapeHtml(post?.slug || '')}" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="post-cover">URL ảnh bìa</label>
          <input class="input" id="post-cover" name="cover_image_url" value="${escapeHtml(post?.cover_image_url || '')}" />
        </div>
        <div class="field">
          <label class="field__label" for="post-excerpt">Tóm tắt</label>
          <input class="input" id="post-excerpt" name="excerpt" value="${escapeHtml(post?.excerpt || '')}" />
        </div>
        <div class="field">
          <label class="field__label" for="post-content">Nội dung</label>
          <textarea class="textarea" id="post-content" name="content" style="min-height:220px">${escapeHtml(post?.content || '')}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="post-meta-title">Meta title (SEO)</label>
            <input class="input" id="post-meta-title" name="meta_title" value="${escapeHtml(post?.meta_title || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="post-meta-desc">Meta description (SEO)</label>
            <input class="input" id="post-meta-desc" name="meta_description" value="${escapeHtml(post?.meta_description || '')}" />
          </div>
        </div>
        <label class="admin-form__checkbox">
          <input type="checkbox" name="is_published" ${post?.is_published ? 'checked' : ''} /> Đăng công khai
        </label>
        <div class="admin-form__actions">
          <button type="submit" class="btn btn--primary">${post ? 'Lưu thay đổi' : 'Tạo bài viết'}</button>
        </div>
      </form>
    </div>`;

  const form = root.querySelector('[data-post-form]');
  const formError = root.querySelector('[data-post-form-error]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;

    const formData = new FormData(form);
    const payload = {
      title: formData.get('title').trim(),
      slug: formData.get('slug').trim(),
      cover_image_url: formData.get('cover_image_url').trim(),
      excerpt: formData.get('excerpt').trim(),
      content: formData.get('content').trim(),
      meta_title: formData.get('meta_title').trim(),
      meta_description: formData.get('meta_description').trim(),
      is_published: formData.get('is_published') === 'on',
    };

    try {
      if (post) {
        await api.put(`/api/admin/content/posts/${post.id}`, payload, { token });
        await renderDetail(post.id);
      } else {
        const created = await api.post('/api/admin/content/posts', payload, { token });
        window.location.href = `./content.html?id=${created.id}`;
      }
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được bài viết.';
    }
  });
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  const postId = new URLSearchParams(window.location.search).get('id');
  if (postId) {
    await renderDetail(postId === 'new' ? null : postId);
  } else {
    await renderList();
  }
}

init();
