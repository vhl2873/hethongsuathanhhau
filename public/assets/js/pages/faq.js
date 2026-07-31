document.querySelectorAll('[data-faq-item]').forEach((item) => {
  const question = item.querySelector('.faq-item__question');
  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('is-open');
    document.querySelectorAll('[data-faq-item].is-open').forEach((openItem) => {
      if (openItem !== item) openItem.classList.remove('is-open');
    });
    item.classList.toggle('is-open', !isOpen);
    question.setAttribute('aria-expanded', String(!isOpen));
  });
});
