// Shared pagination control renderer - used by both customer pages
// (blog.js) and the admin table screens (admin/table.js re-exports this).
export function renderPagination(container, pagination, onPageChange) {
  const { page, totalPages } = pagination;
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const buttons = [];
  for (let p = 1; p <= totalPages; p += 1) {
    buttons.push(
      `<button type="button" class="pagination__page${p === page ? ' is-active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`,
    );
  }
  container.innerHTML = buttons.join('');
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}
