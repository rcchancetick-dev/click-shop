import './site-animations.js';
import './description-links.css';

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
