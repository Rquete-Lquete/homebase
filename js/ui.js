// Shared helpers used by every screen: HTML escaping, icons, dates,
// number formatting, bottom sheets, toasts, clipboard and a small router hook.

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function debounce(fn, ms = 200) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const isStandalone = () =>
  window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

/* ---------- Icons: 24px line drawings coloured with currentColor ---------- */

const PATHS = {
  today: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.1M12 19.3v2.1M4.7 4.7l1.5 1.5M17.8 17.8l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.7 19.3l1.5-1.5M17.8 6.2l1.5-1.5"/>',
  tasks: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.5 1.5 2.5-2.7M3.8 12.1l1.5 1.5 2.5-2.7"/><circle cx="5.6" cy="17.5" r="1.5"/>',
  bus: '<rect x="4.5" y="3" width="15" height="15" rx="3.2"/><path d="M4.5 11.5h15M8 18v2.6M16 18v2.6M8.5 6.5h7"/><circle cx="8.4" cy="14.6" r="1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="14.6" r="1" fill="currentColor" stroke="none"/>',
  health: '<path d="M12 20.3s-7.6-4.5-7.6-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.8c0 5.7-7.6 10.2-7.6 10.2z"/>',
  portfolio: '<rect x="3" y="7" width="18" height="13" rx="2.6"/><path d="M8.6 7V5.6c0-.9.7-1.6 1.6-1.6h3.6c.9 0 1.6.7 1.6 1.6V7M3 12.6h18M10.5 12.6v1.6h3v-1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 7h9.5M18 7h2M4 17h2M10.5 17H20"/><circle cx="15.8" cy="7" r="2.2"/><circle cx="8.2" cy="17" r="2.2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.6 15.6l4.6 4.6"/>',
  location: '<path d="M20 4L3.6 10.7l7 2.7 2.7 7z"/>',
  star: '<path d="M12 3.7l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  starFill: '<path d="M12 3.7l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/>',
  chevRight: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>',
  chevLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevDown: '<path d="M5.5 9.5l6.5 6.5 6.5-6.5"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  refresh: '<path d="M19.6 12a7.6 7.6 0 1 1-2.3-5.4"/><path d="M19.8 4.3v4.3h-4.3"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trash: '<path d="M4.5 7h15M9.6 7V5.2h4.8V7M6.6 7l.9 12.6h9l.9-12.6"/>',
  pencil: '<path d="M4.5 19.5l1-4.4L15.6 5a2.1 2.1 0 0 1 3 3L8.5 18.1z"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.6"/><path d="M15.5 8.5V6.4A2.4 2.4 0 0 0 13.1 4H6.4A2.4 2.4 0 0 0 4 6.4v6.7a2.4 2.4 0 0 0 2.4 2.4h2.1"/>',
  share: '<path d="M12 3.5v11.5M7.6 7.8L12 3.5l4.4 4.3"/><path d="M5.5 11.5v7a1.6 1.6 0 0 0 1.6 1.6h9.8a1.6 1.6 0 0 0 1.6-1.6v-7"/>',
  bell: '<path d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.6 2H4.6z"/><path d="M10 20.6a2 2 0 0 0 4 0"/>',
  paste: '<rect x="5" y="4.6" width="14" height="16" rx="2.6"/><path d="M9 4.6v-.7c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9v.7M8.8 11h6.4M8.8 15h4.4"/>',
  book: '<path d="M12 6.5c-1.8-1.4-4.6-2-7.5-1.8v13.5c2.9-.2 5.7.4 7.5 1.8 1.8-1.4 4.6-2 7.5-1.8V4.7c-2.9-.2-5.7.4-7.5 1.8zM12 6.5v13.5"/>',
  link: '<path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l3-3a3.9 3.9 0 0 0-5.5-5.5l-1.1 1.1"/><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-3 3a3.9 3.9 0 0 0 5.5 5.5l1.1-1.1"/>',
  arrowUp: '<path d="M12 19V5.5M6.5 11L12 5.5l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/>',
  download: '<path d="M12 4v11M7.6 10.8L12 15.2l4.4-4.4"/><path d="M5 19.5h14"/>',
};

export function icon(name, size = 24) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
}

/* ---------- Dates (all local time) ---------- */

export const pad = (n) => String(n).padStart(2, '0');
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Whole days from one YYYY-MM-DD key to another (positive if `to` is later). */
export function dayDiff(fromKey, toKey) {
  const a = fromKey.split('-').map(Number);
  const b = toKey.split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

/** Value for <input type="datetime-local">. */
export const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const fmtLongDate = (d = new Date()) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

export function fmtShortDate(key) {
  const d = keyToDate(key);
  const s = `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return d.getFullYear() === new Date().getFullYear() ? s : `${s} ${d.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday", "Thu" (within a week) or "12 Nov". */
export function fmtDay(key, today = dateKey()) {
  const n = dayDiff(today, key);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return WEEKDAYS[keyToDate(key).getDay()].slice(0, 3);
  return fmtShortDate(key);
}

/** "Thu 12 Nov" — absolute, for text that will be read later. */
export function fmtDayAbs(key) {
  const d = keyToDate(key);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [hRaw, m] = hhmm.split(':').map(Number);
  const h = hRaw % 12 || 12;
  return `${h}:${pad(m)} ${hRaw >= 12 ? 'pm' : 'am'}`;
}

export const fmtClock = (d = new Date()) => fmtTime(`${d.getHours()}:${pad(d.getMinutes())}`);

export function fmtAgo(ts) {
  if (!ts) return 'never';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export const fmtNum = (n, digits = 0) =>
  Number(n).toLocaleString('en-SG', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/* ---------- Page header ---------- */

/** `sub` is trusted HTML: escape anything user-provided before passing it in. */
export function pageHeader(title, { right = '', sub = '', back = null, kicker = '' } = {}) {
  const backBtn = back
    ? `<button class="back" data-action="go" data-route="${esc(back.route)}">${icon('chevLeft', 22)}<span>${esc(back.label)}</span></button>`
    : '';
  return `<header class="page-head">${backBtn}${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
    <div class="head-row"><h1>${esc(title)}</h1>${right ? `<div class="head-actions">${right}</div>` : ''}</div>
    ${sub ? `<p class="head-sub">${sub}</p>` : ''}</header>`;
}

/* ---------- Two-tap confirm for destructive buttons ---------- */

/** Returns true on the second tap within 3.5 s; the first tap swaps the label to a prompt. */
export function armed(el, prompt = 'Tap again to confirm') {
  if (el.dataset.armed === '1') return true;
  const label = el.querySelector('.lbl') || el;
  el.dataset.armed = '1';
  el.dataset.orig = label.textContent;
  label.textContent = prompt;
  el.classList.add('armed');
  setTimeout(() => {
    if (!el.isConnected) return;
    el.dataset.armed = '';
    label.textContent = el.dataset.orig;
    el.classList.remove('armed');
  }, 3500);
  return false;
}

/* ---------- Toast ---------- */

let toastTimer = 0;

export function toast(message, { action = '', actionLabel = '', data = {}, duration = 2800 } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  el.innerHTML = `<span class="toast-msg">${esc(message)}</span>` +
    (action ? `<button class="toast-btn" data-action="${esc(action)}"${attrs}>${esc(actionLabel)}</button>` : '');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? Math.max(duration, 4500) : duration);
}

export function hideToast() {
  document.getElementById('toast')?.classList.remove('show');
}

/* ---------- Bottom sheet ---------- */

let sheetOnClose = null;
let lockedY = 0;

const sheetRoot = () => document.getElementById('sheet-root');
export const sheetIsOpen = () => sheetRoot()?.classList.contains('open') ?? false;
export const sheetBody = () => document.querySelector('#sheet-root .sheet-body');

function lockScroll() {
  lockedY = window.scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${lockedY}px`, left: '0', right: '0' });
}

function unlockScroll() {
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '' });
  window.scrollTo(0, lockedY);
}

export function openSheet(html, { label = '', onClose = null } = {}) {
  const root = sheetRoot();
  const wasOpen = root.classList.contains('open');
  clearTimeout(root._clearTimer);
  root.innerHTML = `<div class="sheet-backdrop" data-action="sheet-close"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="grabber" aria-hidden="true"></div><div class="sheet-body">${html}</div>
    </section>`;
  sheetOnClose = onClose;
  enableDragToClose(root.querySelector('.sheet'));
  if (wasOpen) return;
  lockScroll();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
}

/** Replace the open sheet's content without animating it again. */
export function updateSheet(html) {
  const body = sheetBody();
  if (body) body.innerHTML = html;
}

export function closeSheet() {
  const root = sheetRoot();
  if (!root || !root.classList.contains('open')) return;
  root.classList.remove('open');
  unlockScroll();
  const cb = sheetOnClose;
  sheetOnClose = null;
  root._clearTimer = setTimeout(() => {
    if (!root.classList.contains('open')) root.innerHTML = '';
  }, 450);
  cb?.();
}

function enableDragToClose(sheet) {
  if (!sheet) return;
  let startY = 0;
  let dy = 0;
  let dragging = false;
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.scrollTop > 0 || e.target.closest('input, textarea, select, .chart')) return;
    startY = e.touches[0].clientY;
    dy = 0;
    dragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = dy ? `translateY(${dy}px)` : '';
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    if (dy > 110) closeSheet();
    sheet.style.transform = '';
  }, { passive: true });
}

/* ---------- Clipboard and external links ---------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    Object.assign(ta.style, { position: 'fixed', top: '0', opacity: '0' });
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** Opens a URL that leaves the app (shortcuts://, maps). Tests can intercept it. */
export function openURL(url) {
  if (typeof window.__hbOpenURL === 'function') {
    window.__hbOpenURL(url);
    return;
  }
  window.location.href = url;
}

/* ---------- Router hook (main.js registers the real functions) ---------- */

let router = { render: () => {}, navigate: () => {}, current: () => 'today' };
export const setRouter = (r) => { router = r; };
export const refresh = () => router.render();
export const navigate = (route, opts) => router.navigate(route, opts);
export const currentRoute = () => router.current();
