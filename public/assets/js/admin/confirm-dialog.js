import { escapeHtml } from '../lib/format.js';

// Custom confirm modal - replaces window.confirm() for destructive admin
// actions per the project brief. Resolves true/false; never throws.
export function confirmDialog({ title = 'Xác nhận', message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 class="modal__title" id="confirm-dialog-title">${escapeHtml(title)}</h2>
        <p class="modal__message">${escapeHtml(message)}</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--outline" data-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') close(false);
    }

    overlay.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeyDown);
    overlay.querySelector('[data-confirm]').focus();
  });
}
