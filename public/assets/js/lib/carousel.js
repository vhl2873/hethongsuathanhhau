// Minimal, dependency-free carousel: prev/next arrows, dot navigation,
// auto-rotate that pauses on hover/focus and never runs at all under
// prefers-reduced-motion (motivated by hierarchy - draws attention to the
// promo message - not decoration for its own sake).
const AUTO_ROTATE_MS = 6000;

export function initCarousel(root) {
  const slides = Array.from(root.querySelectorAll('[data-carousel-slide]'));
  const dotsContainer = root.querySelector('[data-carousel-dots]');
  const prevBtn = root.querySelector('[data-carousel-prev]');
  const nextBtn = root.querySelector('[data-carousel-next]');
  if (!slides.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;

  if (dotsContainer) {
    dotsContainer.innerHTML = slides
      .map((_, i) => `<button type="button" class="hero-carousel__dot" data-carousel-dot="${i}" aria-label="Slide ${i + 1}"></button>`)
      .join('');
  }
  const dots = dotsContainer ? Array.from(dotsContainer.querySelectorAll('[data-carousel-dot]')) : [];

  function show(newIndex) {
    index = (newIndex + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  }

  function next() {
    show(index + 1);
  }
  function prev() {
    show(index - 1);
  }

  function startAutoRotate() {
    if (prefersReducedMotion || slides.length < 2) return;
    stopAutoRotate();
    timer = setInterval(next, AUTO_ROTATE_MS);
  }
  function stopAutoRotate() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  prevBtn?.addEventListener('click', () => {
    prev();
    startAutoRotate();
  });
  nextBtn?.addEventListener('click', () => {
    next();
    startAutoRotate();
  });
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      show(i);
      startAutoRotate();
    });
  });

  root.addEventListener('mouseenter', stopAutoRotate);
  root.addEventListener('mouseleave', startAutoRotate);
  root.addEventListener('focusin', stopAutoRotate);
  root.addEventListener('focusout', startAutoRotate);

  show(0);
  startAutoRotate();
}
