import { requireAdminSession } from './admin-auth.js';
import { api, ApiError } from '../lib/api.js';
import { renderTable, renderPagination } from './table.js';
import { confirmDialog } from './confirm-dialog.js';
import { formatCurrency, escapeHtml } from '../lib/format.js';

let token = null;
let currentPage = 1;
let searchTerm = '';
let categories = [];

const root = document.querySelector('[data-products-root]');

// Uploads a single image file to Supabase Storage via the admin API and
// returns its public URL. Never uploads directly from the browser to
// Storage - always goes through the server so the service-role key stays
// server-side and requireAdmin gates who can write to the bucket.
async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const result = await api.post('/api/admin/storage/upload', formData, { token });
  return result.url;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- List view --------------------------------------------------------------
async function renderList() {
  root.innerHTML = `
    <div class="admin-toolbar">
      <h1 class="page-title">Sản phẩm</h1>
      <div style="display:flex; gap: var(--space-3);">
        <input class="input" type="search" placeholder="Tìm sản phẩm..." data-search value="${escapeHtml(searchTerm)}" />
        <a class="btn btn--primary" href="./products.html?id=new">+ Thêm sản phẩm</a>
      </div>
    </div>
    <div data-table></div>
    <div class="pagination" data-pagination></div>`;

  root.querySelector('[data-search]').addEventListener(
    'input',
    debounce((event) => {
      searchTerm = event.target.value;
      currentPage = 1;
      loadList();
    }, 400),
  );

  await loadList();
}

async function loadList() {
  const tableEl = root.querySelector('[data-table]');
  tableEl.innerHTML = '<div class="skeleton" style="height:240px;border-radius:16px"></div>';

  try {
    const query = new URLSearchParams({ page: currentPage, limit: 20 });
    if (searchTerm) query.set('search', searchTerm);
    const { data: products, pagination } = await api.get(`/api/admin/products?${query}`, { token, raw: true });

    renderTable({
      container: tableEl,
      rows: products,
      getRowId: (p) => p.id,
      emptyMessage: 'Chưa có sản phẩm nào.',
      columns: [
        {
          label: 'Ảnh',
          render: (p) => (p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" width="40" height="40" style="border-radius:8px;object-fit:cover" />` : '-'),
        },
        { key: 'name', label: 'Tên sản phẩm' },
        { label: 'Danh mục', render: (p) => p.category_name || '-' },
        { label: 'Giá', render: (p) => formatCurrency(p.base_price) },
        { key: 'total_stock', label: 'Tồn kho' },
        {
          label: 'Trạng thái',
          render: (p) => (p.is_active ? '<span class="badge badge--success">Đang bán</span>' : '<span class="badge badge--danger">Ẩn</span>'),
        },
      ],
      rowActions: (p) => `
        <a class="btn btn--outline" href="./products.html?id=${p.id}">Sửa</a>
        <button type="button" class="btn btn--danger" data-delete="${p.id}">Xoá</button>`,
    });

    tableEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteProduct(Number(btn.dataset.delete), products));
    });

    renderPagination(root.querySelector('[data-pagination]'), pagination, (page) => {
      currentPage = page;
      loadList();
    });
  } catch {
    tableEl.innerHTML = `<div class="empty-state"><p class="empty-state__title">Không tải được sản phẩm</p></div>`;
  }
}

async function handleDeleteProduct(id, products) {
  const product = products.find((p) => p.id === id);
  const confirmed = await confirmDialog({
    title: 'Xoá sản phẩm',
    message: `Xoá sản phẩm "${product?.name}"? Hành động này không thể hoàn tác.`,
  });
  if (!confirmed) return;

  try {
    await api.delete(`/api/admin/products/${id}`, { token });
    await loadList();
  } catch {
    window.alert('Không xoá được sản phẩm.');
  }
}

// --- Detail / edit view -------------------------------------------------------
async function renderDetail(productId) {
  root.innerHTML = '<div class="skeleton" style="height:400px;border-radius:16px"></div>';

  try {
    categories = await api.get('/api/admin/categories', { token });
  } catch {
    categories = [];
  }

  let product = null;
  if (productId) {
    try {
      product = await api.get(`/api/admin/products/${productId}`, { token });
    } catch {
      root.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__title">Không tìm thấy sản phẩm</p>
          <a class="btn btn--primary" href="./products.html">Quay lại danh sách</a>
        </div>`;
      return;
    }
  }

  root.innerHTML = `
    <a class="admin-back-link" href="./products.html">&larr; Quay lại danh sách sản phẩm</a>
    <h1 class="page-title">${product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h1>

    <div class="admin-form-panel">
      <div class="alert alert--danger" data-product-form-error hidden></div>
      <form data-product-form novalidate>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="p-name">Tên sản phẩm</label>
            <input class="input" id="p-name" name="name" required value="${escapeHtml(product?.name || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="p-slug">Slug (để trống để tự tạo)</label>
            <input class="input" id="p-slug" name="slug" value="${escapeHtml(product?.slug || '')}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="p-category">Danh mục</label>
            <select class="select" id="p-category" name="category_id">
              <option value="">— Không có —</option>
              ${categories
                .map((c) => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="p-brand">Thương hiệu</label>
            <input class="input" id="p-brand" name="brand" value="${escapeHtml(product?.brand || '')}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="p-price">Giá niêm yết (đ)</label>
            <input class="input" type="number" min="0" id="p-price" name="base_price" required value="${product?.base_price ?? ''}" />
          </div>
          <div class="field">
            <label class="field__label" for="p-compare">Giá so sánh (đ, không bắt buộc)</label>
            <input class="input" type="number" min="0" id="p-compare" name="compare_at_price" value="${product?.compare_at_price ?? ''}" />
          </div>
        </div>
        ${
          product
            ? ''
            : `
        <div class="field">
          <label class="field__label" for="p-stock">Tồn kho ban đầu</label>
          <input class="input" type="number" min="0" id="p-stock" name="stock_quantity" value="0" />
        </div>`
        }
        <div class="field">
          <label class="field__label" for="p-short">Mô tả ngắn</label>
          <input class="input" id="p-short" name="short_description" value="${escapeHtml(product?.short_description || '')}" />
        </div>
        <div class="field">
          <label class="field__label" for="p-desc">Mô tả chi tiết</label>
          <textarea class="textarea" id="p-desc" name="description">${escapeHtml(product?.description || '')}</textarea>
        </div>
        <label class="admin-form__checkbox">
          <input type="checkbox" name="is_active" ${product?.is_active !== false ? 'checked' : ''} /> Đang bán (hiển thị trên website)
        </label>
        <label class="admin-form__checkbox">
          <input type="checkbox" name="is_featured" ${product?.is_featured ? 'checked' : ''} /> Sản phẩm nổi bật
        </label>

        ${
          product
            ? ''
            : `
        <div class="field">
          <label class="field__label" for="p-images">Ảnh sản phẩm * (chọn ít nhất 1 ảnh, ảnh đầu tiên sẽ là ảnh chính)</label>
          <input class="input" type="file" id="p-images" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple required />
          <span class="field__error" data-error="images"></span>
        </div>`
        }

        <div class="admin-form__actions">
          <button type="submit" class="btn btn--primary">${product ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</button>
        </div>
      </form>
    </div>

    ${
      product
        ? `
    <div class="admin-form-panel">
      <h2 class="admin-form-panel__heading">Biến thể &amp; tồn kho</h2>
      <div data-variants-table></div>
      <button type="button" class="btn btn--outline" data-add-variant>+ Thêm biến thể</button>
      <form class="admin-inline-form" data-variant-form hidden>
        <input type="hidden" name="variantId" />
        <div class="field-row">
          <div class="field"><label class="field__label">Tên biến thể</label><input class="input" name="name" required /></div>
          <div class="field"><label class="field__label">SKU</label><input class="input" name="sku" required /></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field__label">Giá (đ)</label><input class="input" type="number" min="0" name="price" required /></div>
          <div class="field"><label class="field__label">Tồn kho</label><input class="input" type="number" min="0" name="stock_quantity" required /></div>
        </div>
        <div class="alert alert--danger" data-variant-form-error hidden></div>
        <div class="admin-form__actions">
          <button type="submit" class="btn btn--primary">Lưu biến thể</button>
          <button type="button" class="btn btn--outline" data-cancel-variant>Hủy</button>
        </div>
      </form>
    </div>

    <div class="admin-form-panel">
      <h2 class="admin-form-panel__heading">Hình ảnh</h2>
      <div class="admin-image-list" data-images-list></div>
      <form data-image-form>
        <div class="field-row">
          <div class="field">
            <label class="field__label">Chọn ảnh</label>
            <input class="input" type="file" name="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
          </div>
          <div class="field"><label class="field__label">Mô tả ảnh (alt)</label><input class="input" name="alt_text" /></div>
        </div>
        <label class="admin-form__checkbox"><input type="checkbox" name="is_primary" /> Đặt làm ảnh chính</label>
        <div class="alert alert--danger" data-image-form-error hidden></div>
        <button type="submit" class="btn btn--primary">+ Tải ảnh lên</button>
      </form>
    </div>`
        : ''
    }
  `;

  wireProductForm(product);
  if (product) {
    wireVariants(product);
    wireImages(product);
  }
}

function wireProductForm(product) {
  const form = root.querySelector('[data-product-form]');
  const formError = root.querySelector('[data-product-form-error]');
  const imagesInput = root.querySelector('#p-images');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    root.querySelectorAll('[data-error]').forEach((el) => (el.textContent = ''));

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name').trim(),
      slug: formData.get('slug').trim(),
      category_id: formData.get('category_id') || null,
      brand: formData.get('brand').trim(),
      base_price: Number(formData.get('base_price')),
      compare_at_price: formData.get('compare_at_price') ? Number(formData.get('compare_at_price')) : null,
      short_description: formData.get('short_description').trim(),
      description: formData.get('description').trim(),
      is_active: formData.get('is_active') === 'on',
      is_featured: formData.get('is_featured') === 'on',
    };

    // New products must ship with at least one real image - no fake/blank
    // placeholder products in the catalog.
    if (!product) {
      payload.stock_quantity = Number(formData.get('stock_quantity')) || 0;

      const files = Array.from(imagesInput.files);
      if (!files.length) {
        const errorEl = root.querySelector('[data-error="images"]');
        if (errorEl) errorEl.textContent = 'Vui lòng chọn ít nhất 1 ảnh cho sản phẩm.';
        return;
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = product ? 'Đang lưu...' : 'Đang tạo sản phẩm...';

    try {
      if (product) {
        await api.put(`/api/admin/products/${product.id}`, payload, { token });
        await renderDetail(product.id);
        return;
      }

      const created = await api.post('/api/admin/products', payload, { token });

      const files = Array.from(imagesInput.files);
      submitBtn.textContent = `Đang tải ảnh lên (0/${files.length})...`;
      for (const [index, file] of files.entries()) {
        const url = await uploadImageFile(file);
        await api.post(`/api/admin/products/${created.id}/images`, { url, alt_text: created.name, is_primary: index === 0 }, { token });
        submitBtn.textContent = `Đang tải ảnh lên (${index + 1}/${files.length})...`;
      }

      window.location.href = `./products.html?id=${created.id}`;
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được sản phẩm.';
      submitBtn.disabled = false;
      submitBtn.textContent = product ? 'Lưu thay đổi' : 'Tạo sản phẩm';
    }
  });
}

function wireVariants(product) {
  const tableEl = root.querySelector('[data-variants-table]');
  const form = root.querySelector('[data-variant-form]');
  const formError = root.querySelector('[data-variant-form-error]');

  function renderVariantsTable() {
    renderTable({
      container: tableEl,
      rows: product.product_variants,
      getRowId: (v) => v.id,
      emptyMessage: 'Chưa có biến thể nào.',
      columns: [
        { key: 'name', label: 'Tên' },
        { key: 'sku', label: 'SKU' },
        { label: 'Giá', render: (v) => formatCurrency(v.price) },
        { key: 'stock_quantity', label: 'Tồn kho' },
        {
          label: 'Trạng thái',
          render: (v) => (v.is_active ? '<span class="badge badge--success">Bán</span>' : '<span class="badge badge--danger">Ẩn</span>'),
        },
      ],
      rowActions: (v) => `
        <button type="button" class="btn btn--outline" data-edit-variant="${v.id}">Sửa</button>
        <button type="button" class="btn btn--danger" data-delete-variant="${v.id}">Xoá</button>`,
    });

    tableEl.querySelectorAll('[data-edit-variant]').forEach((btn) => {
      btn.addEventListener('click', () =>
        showVariantForm(product.product_variants.find((v) => v.id === Number(btn.dataset.editVariant))),
      );
    });
    tableEl.querySelectorAll('[data-delete-variant]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteVariant(Number(btn.dataset.deleteVariant)));
    });
  }

  function showVariantForm(variant) {
    form.hidden = false;
    formError.hidden = true;
    form.elements.variantId.value = variant?.id || '';
    form.elements.name.value = variant?.name || '';
    form.elements.sku.value = variant?.sku || '';
    form.elements.price.value = variant?.price ?? '';
    form.elements.stock_quantity.value = variant?.stock_quantity ?? '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  root.querySelector('[data-add-variant]').addEventListener('click', () => showVariantForm(null));
  root.querySelector('[data-cancel-variant]').addEventListener('click', () => {
    form.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name').trim(),
      sku: formData.get('sku').trim(),
      price: Number(formData.get('price')),
      stock_quantity: Number(formData.get('stock_quantity')),
    };
    const variantId = formData.get('variantId');

    try {
      if (variantId) {
        await api.put(`/api/admin/products/${product.id}/variants/${variantId}`, payload, { token });
      } else {
        await api.post(`/api/admin/products/${product.id}/variants`, payload, { token });
      }
      product = await api.get(`/api/admin/products/${product.id}`, { token });
      form.hidden = true;
      renderVariantsTable();
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không lưu được biến thể.';
    }
  });

  async function handleDeleteVariant(variantId) {
    const confirmed = await confirmDialog({ title: 'Xoá biến thể', message: 'Xoá biến thể này?' });
    if (!confirmed) return;
    try {
      await api.delete(`/api/admin/products/${product.id}/variants/${variantId}`, { token });
      product = await api.get(`/api/admin/products/${product.id}`, { token });
      renderVariantsTable();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Không xoá được biến thể.');
    }
  }

  renderVariantsTable();
}

function wireImages(product) {
  const listEl = root.querySelector('[data-images-list]');
  const form = root.querySelector('[data-image-form]');
  const formError = root.querySelector('[data-image-form-error]');

  function renderImages() {
    if (!product.product_images.length) {
      listEl.innerHTML = '<p class="empty-state__title">Chưa có ảnh nào.</p>';
      return;
    }
    listEl.innerHTML = product.product_images
      .map(
        (img) => `
      <div class="admin-image-item">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt_text || '')}" width="64" height="64" />
        ${img.is_primary ? '<span class="badge badge--success">Ảnh chính</span>' : ''}
        <button type="button" class="btn btn--danger" data-delete-image="${img.id}">Xoá</button>
      </div>`,
      )
      .join('');

    listEl.querySelectorAll('[data-delete-image]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({ title: 'Xoá ảnh', message: 'Xoá ảnh này khỏi sản phẩm?' });
        if (!confirmed) return;
        try {
          await api.delete(`/api/admin/products/${product.id}/images/${btn.dataset.deleteImage}`, { token });
          product = await api.get(`/api/admin/products/${product.id}`, { token });
          renderImages();
        } catch {
          window.alert('Không xoá được ảnh.');
        }
      });
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const formData = new FormData(form);
    const file = formData.get('file');
    const altText = formData.get('alt_text').trim();
    const isPrimary = formData.get('is_primary') === 'on';

    if (!file || !file.size) {
      formError.hidden = false;
      formError.textContent = 'Vui lòng chọn 1 file ảnh.';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang tải lên...';

    try {
      const url = await uploadImageFile(file);
      await api.post(`/api/admin/products/${product.id}/images`, { url, alt_text: altText, is_primary: isPrimary }, { token });
      product = await api.get(`/api/admin/products/${product.id}`, { token });
      form.reset();
      renderImages();
    } catch (err) {
      formError.hidden = false;
      formError.textContent = err instanceof ApiError ? err.message : 'Không thêm được ảnh.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '+ Tải ảnh lên';
    }
  });

  renderImages();
}

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  token = session.token;

  const productId = new URLSearchParams(window.location.search).get('id');
  if (productId) {
    await renderDetail(productId === 'new' ? null : productId);
  } else {
    await renderList();
  }
}

init();
