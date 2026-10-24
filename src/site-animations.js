import './product-interactions.js';
import './site-animations.css';

const root = document.getElementById('root');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
const seen = new WeakSet();
function play(element, frames, options = {}) {
  if (reduced.matches || !element?.animate) return;
  const animation = element.animate(frames, { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)', ...options });
  running.add(animation);
  animation.finished.then(() => running.delete(animation), () => running.delete(animation));
}
reduced.addEventListener('change', () => {
  if (reduced.matches) { running.forEach(animation => animation.cancel()); running.clear(); }
});
const reveal = 'main .sectionhead, main .shopTitle, main .pillar, main .steps li, main .card, main .adminhead, main .adminLogin, footer .footgrid > div';
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    const element = entry.target;
    const siblings = element.parentElement ? [...element.parentElement.children] : [];
    const delay = element.matches('.card, .steps li, .pillar') ? Math.max(0, siblings.indexOf(element) % 4) * 55 : 0;
    play(element, [{ opacity: .35, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay });
  });
}, { threshold: .08 }) : null;
let queued = false, lastCount = null;
function scan() {
  queued = false;
  root.querySelectorAll(reveal).forEach(element => {
    if (seen.has(element)) return;
    seen.add(element);
    observer?.observe(element);
  });
  const badge = root.querySelector('.cartbtn b');
  const count = badge ? Number(badge.textContent) : null;
  if (count !== null && Number.isFinite(count)) {
    if (lastCount !== null && count > lastCount) {
      play(badge, [{ transform: 'scale(1)' }, { transform: 'scale(1.28)', offset: .4 }, { transform: 'scale(1)' }], { duration: 300 });
    }
    lastCount = count;
  }
}
function schedule() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
root.addEventListener('click', event => {
  const button = event.target.closest('button.add');
  if (button && !button.disabled) play(button, [{ transform: 'scale(1)' }, { transform: 'scale(.97)', offset: .35 }, { transform: 'scale(1)' }], { duration: 200 });
});
document.querySelectorAll('.product-dialog, .image-dialog').forEach(dialog => {
  new MutationObserver(() => {
    if (dialog.open) play(dialog, [{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 200 });
  }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
});
let scrollQueued = false;
function updateHeader() {
  scrollQueued = false;
  root.querySelector('.nav')?.classList.toggle('nav-scrolled', window.scrollY > 16);
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateHeader); }
}, { passive: true });
new MutationObserver(updateHeader).observe(root, { childList: true });
scan();
updateHeader();
