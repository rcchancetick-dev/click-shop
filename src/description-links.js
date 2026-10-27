import './site-animations.js';
import './description-links.css';
import './detail-prices.css';

const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
function trimEnding(value) {
  let result = value.replace(/[.,;:!?]+$/, '');
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']];
  let changed = true;
  while (changed && result) {
    changed = false;
    for (const [open, close] of pairs) {
      if (result.endsWith(close) && result.split(close).length > result.split(open).length) {
        result = result.slice(0, -1).replace(/[.,;:!?]+$/, '');
        changed = true;
      }
    }
  }
  return result;
}
function linkify(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) { return node.parentElement?.closest('a, script, style, textarea, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.textContent || '';
    const fragment = document.createDocumentFragment();
    let end = 0, found = false;
    for (const match of text.matchAll(pattern)) {
      const label = trimEnding(match[0]);
      if (!label) continue;
      let url;
      try { url = new URL(/^www\./i.test(label) ? 'https://' + label : label); } catch { continue; }
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) continue;
      fragment.append(document.createTextNode(text.slice(end, match.index)));
      const anchor = document.createElement('a');
      anchor.href = url.href; anchor.textContent = label;
      anchor.className = 'description-link'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('aria-label', label + ' — nouvel onglet');
      fragment.append(anchor);
      end = match.index + label.length; found = true;
    }
    if (found) { fragment.append(document.createTextNode(text.slice(end))); node.replaceWith(fragment); }
  }
}
let queued = false;
function scan() {
  queued = false;
  document.querySelectorAll('#root .card .desc, .product-dialog .detail-description').forEach(linkify);
}
function schedule() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
const observer = new MutationObserver(schedule);
const root = document.getElementById('root');
if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });
document.querySelectorAll('.product-dialog .detail-description').forEach(element => observer.observe(element, { childList: true, subtree: true, characterData: true }));
schedule();

root?.addEventListener('click', event => {
  const more = event.target.closest('.product-more');
  if (!more) return;
  const source = more.closest('.card')?.querySelector('.price');
  const target = document.querySelector('.product-dialog[open] .detail-price');
  if (!source || !target) return;
  const copy = source.cloneNode(true);
  const previous = copy.querySelector('del')?.textContent.trim() || '';
  copy.querySelectorAll('del').forEach(element => element.remove());
  const current = copy.textContent.trim();
  const line = document.createElement('span'); line.className = 'detail-current-line';
  const label = document.createElement('span'); label.className = 'detail-price-label'; label.textContent = 'Prix actuel';
  const amount = document.createElement('strong'); amount.className = 'detail-current-amount'; amount.textContent = current;
  line.append(label, amount); target.replaceChildren(line);
  if (previous) {
    const oldLine = document.createElement('span'); oldLine.className = 'detail-previous-line';
    const oldLabel = document.createElement('span'); oldLabel.textContent = 'Ancien prix : ';
    const oldAmount = document.createElement('del'); oldAmount.textContent = previous;
    oldLine.append(oldLabel, oldAmount); target.append(oldLine);
  }
});
