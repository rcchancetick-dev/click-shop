import './main.jsx';
import './mobile-products.css';

const root = document.getElementById('root');
const details = document.createElement('dialog');
details.className = 'product-dialog';
details.setAttribute('aria-labelledby', 'product-detail-title');
details.innerHTML = `<header class="dialog-header"><span>Détails du produit</span><button type="button" class="dialog-close" aria-label="Fermer la fiche produit">✕</button></header><div class="product-detail-grid"><button type="button" class="detail-photo" aria-label="Agrandir la photo du produit"><img alt=""><span>Agrandir l’image</span></button><div class="detail-copy"><p class="detail-meta"></p><h2 id="product-detail-title"></h2><p class="detail-price"></p><p class="detail-description"></p><button type="button" class="primary detail-cart"></button></div></div>`;
const viewer = document.createElement('dialog');
viewer.className = 'image-dialog';
viewer.setAttribute('aria-label', 'Image du produit agrandie');
viewer.innerHTML = `<header class="zoom-toolbar"><button type="button" data-zoom="out" aria-label="Réduire l’image">−</button><button type="button" data-zoom="reset" aria-label="Réinitialiser le zoom">100 %</button><button type="button" data-zoom="in" aria-label="Agrandir l’image">+</button><button type="button" class="dialog-close" aria-label="Fermer l’image">✕</button></header><p class="zoom-hint">Utilisez + et − pour zoomer, puis faites défiler l’image pour explorer les détails.</p><div class="zoom-stage" tabindex="0" aria-label="Image défilable"><div class="zoom-canvas"><img alt=""></div></div>`;
document.body.append(details, viewer);
let scale = 1, cartAction = null, activeImage = null;
const stage = viewer.querySelector('.zoom-stage');
const zoomImage = viewer.querySelector('img');
const resetButton = viewer.querySelector('[data-zoom=reset]');
const openers = new WeakMap();
function syncScrollLock() { document.body.classList.toggle('product-modal-open', details.open || viewer.open); }
function openDialog(dialog, opener) {
  openers.set(dialog, opener || document.activeElement);
  if (!dialog.open) dialog.showModal();
  syncScrollLock();
}
for (const dialog of [details, viewer]) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    syncScrollLock();
    const opener = openers.get(dialog);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
}
function drawZoom() {
  const ratio = zoomImage.naturalWidth / (zoomImage.naturalHeight || 1);
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  const base = Math.min(zoomImage.naturalWidth, Math.max(80, stage.clientWidth - 24), Math.max(80, stage.clientHeight - 24) * ratio);
  zoomImage.style.width = Math.round(base * scale) + 'px';
  resetButton.textContent = Math.round(scale * 100) + ' %';
  viewer.querySelector('[data-zoom=out]').disabled = scale <= 1;
  viewer.querySelector('[data-zoom=in]').disabled = scale >= 4;
}
function openZoom(image, opener) {
  if (!image?.src) return;
  scale = 1;
  zoomImage.onload = drawZoom;
  zoomImage.src = image.currentSrc || image.src;
  zoomImage.alt = image.alt || 'Image du produit';
  openDialog(viewer, opener);
  stage.scrollTo(0, 0);
  requestAnimationFrame(drawZoom);
}
viewer.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.zoom;
  scale = action === 'reset' ? 1 : Math.max(1, Math.min(4, scale + (action === 'in' ? .5 : -.5)));
  drawZoom();
  if (scale === 1) stage.scrollTo(0, 0);
}));
zoomImage.addEventListener('dblclick', () => { scale = scale === 1 ? 2 : 1; drawZoom(); });
window.addEventListener('resize', () => { if (viewer.open) drawZoom(); });
details.querySelector('.detail-photo').addEventListener('click', e => openZoom(activeImage, e.currentTarget));
details.querySelector('.detail-cart').addEventListener('click', () => {
  const action = cartAction;
  details.close();
  if (action?.isConnected) action.click();
});
function openDetails(card, opener) {
  activeImage = card.querySelector('.pic img');
  const image = details.querySelector('.detail-photo img');
  const photo = details.querySelector('.detail-photo');
  photo.hidden = !activeImage;
  if (activeImage) { image.src = activeImage.currentSrc || activeImage.src; image.alt = activeImage.alt; }
  details.querySelector('h2').textContent = card.querySelector('h3')?.textContent || 'Produit';
  details.querySelector('.detail-meta').textContent = [card.querySelector('.meta small')?.textContent, card.querySelector('.chip')?.textContent].filter(Boolean).join(' · ');
  details.querySelector('.detail-price').textContent = card.querySelector('.price')?.textContent || '';
  details.querySelector('.detail-description').textContent = card.querySelector('.desc')?.textContent || '';
  cartAction = card.querySelector('.add');
  const action = details.querySelector('.detail-cart');
  action.hidden = !cartAction;
  action.textContent = cartAction?.matches('a') ? 'Voir mon panier' : 'Ajouter au panier';
  openDialog(details, opener);
}
root.addEventListener('click', e => {
  const more = e.target.closest('.product-more');
  if (more) { const card = more.closest('.card'); if (card) openDetails(card, more); return; }
  const target = e.target.closest('[data-product-zoom]');
  if (target) openZoom(target.matches('img') ? target : target.querySelector('img'), target);
});
root.addEventListener('keydown', e => {
  const target = e.target.closest('[data-product-zoom]');
  if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); target.click(); }
});
let queued = false;
const observed = new WeakSet();
const resize = new ResizeObserver(() => schedule());
function enhance() {
  queued = false;
  root.querySelectorAll('.card').forEach(card => {
    const description = card.querySelector('.desc');
    if (!description) return;
    if (!observed.has(description)) { observed.add(description); resize.observe(description); }
    let button = card.querySelector('.product-more');
    const truncated = description.scrollHeight > description.clientHeight + 1;
    if (truncated && !button) {
      button = document.createElement('button');
      button.type = 'button'; button.className = 'product-more'; button.textContent = 'Voir plus';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label', 'Voir les détails de ' + (card.querySelector('h3')?.textContent || 'ce produit'));
      description.after(button);
    }
    if (button && button.hidden === truncated) button.hidden = !truncated;
  });
  root.querySelectorAll('.card .pic, .cartrow > img, .adminproduct > img').forEach(target => {
    if (target.hasAttribute('data-product-zoom') || (!target.matches('img') && !target.querySelector('img'))) return;
    target.setAttribute('data-product-zoom', ''); target.setAttribute('role', 'button'); target.tabIndex = 0;
    target.setAttribute('aria-haspopup', 'dialog'); target.setAttribute('aria-label', 'Agrandir l’image du produit');
  });
}
function schedule() { if (!queued) { queued = true; requestAnimationFrame(enhance); } }
new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
window.addEventListener('resize', schedule);
document.fonts?.ready.then(schedule);
schedule();
