// Tiny scroll-reveal utility shared by every page - fades/slides elements
// marked [data-reveal] into place once they enter the viewport. Collapses
// to an instant, fully-visible state under prefers-reduced-motion instead
// of skipping the content or leaving it stuck at opacity:0.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function observeReveal(selector = '[data-reveal]') {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  if (prefersReducedMotion) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  elements.forEach((el) => observer.observe(el));
}
