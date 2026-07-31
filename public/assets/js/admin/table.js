import { escapeHtml } from '../lib/format.js';

// Dumb, reusable table renderer for admin list screens: caller fetches
// data and owns state (page, filters, selection); this only renders markup
// and wires the DOM events back to callbacks. Kept deliberately simple -
// no virtual DOM, no framework - matches the rest of the project.
export function renderTable({
  container,
  columns,
  rows,
  getRowId,
  rowActions,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  emptyMessage = 'Không có dữ liệu.',
}) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state"><p class="empty-state__title">${escapeHtml(emptyMessage)}</p></div>`;
    return;
  }

  const allSelected = selectable && rows.every((row) => selectedIds.has(getRowId(row)));

  container.innerHTML = `
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            ${selectable ? `<th><input type="checkbox" data-select-all ${allSelected ? 'checked' : ''} /></th>` : ''}
            ${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')}
            ${rowActions ? '<th>Thao tác</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const id = getRowId(row);
              return `
              <tr data-row-id="${id}">
                ${selectable ? `<td><input type="checkbox" data-select-row value="${id}" ${selectedIds.has(id) ? 'checked' : ''} /></td>` : ''}
                ${columns.map((col) => `<td>${col.render ? col.render(row) : escapeHtml(row[col.key] ?? '')}</td>`).join('')}
                ${rowActions ? `<td class="admin-table__actions">${rowActions(row)}</td>` : ''}
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;

  if (selectable) {
    container.querySelector('[data-select-all]')?.addEventListener('change', (event) => {
      onToggleSelectAll?.(event.target.checked, rows.map(getRowId));
    });
    container.querySelectorAll('[data-select-row]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        onToggleSelect?.(Number(event.target.value), event.target.checked);
      });
    });
  }
}

export { renderPagination } from '../lib/pagination.js';
