const items = Array.from(document.querySelectorAll('[data-faq-item]'));

function openItem(item) {
  items.forEach((other) => {
    const isTarget = other === item;
    other.classList.toggle('is-open', isTarget);
    other.querySelector('.faq-item__question')?.setAttribute('aria-expanded', String(isTarget));
  });
}

function closeItem(item) {
  item.classList.remove('is-open');
  item.querySelector('.faq-item__question')?.setAttribute('aria-expanded', 'false');
}

items.forEach((item) => {
  const question = item.querySelector('.faq-item__question');
  question.addEventListener('click', () => {
    if (item.classList.contains('is-open')) closeItem(item);
    else openItem(item);
  });
});

// Footer and menu links point at a specific question (faq.html#giao-hang),
// so honour the hash: open that answer and scroll to it instead of dropping
// the reader at the top of a list of collapsed questions.
function openFromHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const target = items.find((item) => item.id === id);
  if (!target) return;
  openItem(target);
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.addEventListener('hashchange', openFromHash);
openFromHash();
