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
  plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.2 14.8l2.3 2.3 4.6-4.6"/>',
  idp: '<path d="M12 4.5L2.5 9.3 12 14l9.5-4.7z"/><path d="M6.5 11.6v4.6c1.5 1.4 3.4 2.1 5.5 2.1s4-.7 5.5-2.1v-4.6M21.5 9.3v5.2"/>',
  timer: '<circle cx="12" cy="13.2" r="7.6"/><path d="M12 9v4.4l2.8 1.8M9.6 2.8h4.8"/>',
  play: '<path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  flag: '<path d="M5.5 21V4M5.5 4.8c4.2-2.2 6.8 2 13 0v8.6c-6.2 2-8.8-2.2-13 0"/>',
  pin: '<path d="M12 21.2s-6.6-5.9-6.6-11A6.6 6.6 0 0 1 12 3.6a6.6 6.6 0 0 1 6.6 6.6c0 5.1-6.6 11-6.6 11z"/><circle cx="12" cy="10.2" r="2.3"/>',
  minimize: '<path d="M5.5 9.5l6.5 6.5 6.5-6.5"/>',
  flame: '<path d="M12 21c3.6 0 6.4-2.6 6.4-6.2 0-2.6-1.4-4.4-2.6-5.9-.6 1.4-1.3 2-2.2 2.3.3-2.9-.8-5.8-3.4-7.7.2 2.6-.9 4.2-2.2 5.8-1.2 1.5-2.4 3.1-2.4 5.5C5.6 18.4 8.4 21 12 21z"/>',
};

export function icon(name, size = 24) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
}

/* ---------- Motion: rings, count-up, haptics, confetti ---------- */

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Progress ring. The arc animates from empty when .ring gets .go (see animateIn). */
export function ring(pct, { size = 64, stroke = 7, color = 'var(--tasks)', label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" style="stroke:${color}"/>
    <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" style="stroke:${color};--c:${c};--off:${c * (1 - p)}"
      stroke-dasharray="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}

/** Starts ring and bar animations and counts numbers up inside `root`. */
export function animateIn(root) {
  const still = reducedMotion();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.ring, .grow-bar').forEach((el) => el.classList.add('go'));
  }));
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    if (still || !Number.isFinite(to) || to === 0) { el.textContent = fmtNum(to); return; }
    const t0 = performance.now();
    const dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = fmtNum(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** A light tap on iPhones (Safari 17.4+ ticks when a switch control flips); silent elsewhere. */
let hapticLabel = null;
export function haptic() {
  try {
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      hapticLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch { /* no haptics here */ }
}

/** A one-second burst of paper bits from a point (used when the day's tasks are all done). */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 3) {
  if (reducedMotion()) return;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = window.innerWidth * dpr;
  cv.height = window.innerHeight * dpr;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:90;pointer-events:none';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#FFB000', '#FF375F', '#0A84FF', '#30D158', '#BF5AF2'];
  const bits = Array.from({ length: 70 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: Math.random() * 6, s: 4 + Math.random() * 5, c: colors[i % colors.length] };
  });
  const t0 = performance.now();
  const frame = (t) => {
    const age = (t - t0) / 1400;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += 0.2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age);
      ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    }
    if (age < 1) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

/** Minutes since midnight for "HH:MM". */
export const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export function fmtDur(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
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
