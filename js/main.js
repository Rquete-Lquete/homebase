// Entry point: routing between screens, the tab bar, swipe gestures, and one set
// of event listeners that hand clicks, form submits and typing to each screen.

import { saveNow } from './store.js';
import * as ui from './ui.js';
import * as today from './today.js';
import * as plan from './plan.js';
import * as tasks from './tasks.js';
import * as timetable from './timetable.js';
import * as grades from './grades.js';
import * as bus from './bus.js';
import * as health from './health.js';
import * as idp from './idp.js';
import * as focus from './focus.js';
import * as weather from './weather.js';
import * as settings from './settings.js';

const VIEWS = {
  today: today.view,
  plan: plan.view,
  bus: bus.view,
  health: health.view,
  idp: idp.view,
  settings: settings.view,
  guide: settings.guideView,
};

const TABS = [['today', 'Today'], ['plan', 'Plan'], ['bus', 'Bus'], ['health', 'Health'], ['idp', 'IDP']];
const ORDER = TABS.map((t) => t[0]);
const PARENT = { settings: 'today', guide: 'today' };
const modules = [today, plan, tasks, timetable, grades, bus, health, idp, focus, weather, settings];
const pick = (name) => Object.assign({}, ...modules.map((m) => m[name] || {}));
const actions = pick('actions');
const forms = pick('forms');
const inputs = pick('inputs');
const changes = pick('changes');

const LEGACY = { tasks: 'plan', portfolio: 'idp' };
let route = sessionStorage.getItem('hb.route');
route = LEGACY[route] || route;
if (!VIEWS[route]) route = 'today';
let routeOpts = {};
const scrollMemory = {};

function render() {
  const v = VIEWS[route];
  const main = document.getElementById('view');
  main.innerHTML = v.render(routeOpts);
  main.dataset.route = route;
  document.body.dataset.route = PARENT[route] || route;
  document.getElementById('topbar-title').textContent = v.title();
  v.mount?.(main, routeOpts);
  main.querySelectorAll('textarea.grow').forEach(autoGrow);
  ui.animateIn(main);
  updateTabbar();
  bus.refreshVisible(false);
  onScroll();
}

function navigate(next, opts = {}) {
  next = LEGACY[next] || next;
  if (!VIEWS[next]) return;
  const same = next === route;
  const from = ORDER.indexOf(PARENT[route] || route);
  const to = ORDER.indexOf(PARENT[next] || next);
  scrollMemory[route] = window.scrollY;
  ui.closeSheet();
  if (next === 'plan' && opts.seg) plan.setSegment(opts.seg);
  route = next;
  routeOpts = opts;
  sessionStorage.setItem('hb.route', next);
  render();
  if (!opts.section) window.scrollTo(0, same ? 0 : scrollMemory[next] || 0);
  if (!same) {
    // Slide the new screen in from the side it sits on in the tab bar.
    const main = document.getElementById('view');
    main.classList.remove('nav-left', 'nav-right');
    void main.offsetWidth;
    main.classList.add(to >= from ? 'nav-right' : 'nav-left');
  }
}

function updateTabbar() {
  const active = PARENT[route] || route;
  const bar = document.getElementById('tabbar');
  bar.style.setProperty('--tab-i', String(Math.max(0, ORDER.indexOf(active))));
  bar.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === active;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
}

function onScroll() {
  if (document.body.style.position === 'fixed') return; // a sheet is open
  document.body.classList.toggle('scrolled', window.scrollY > 48);
}

/* ---------- Core actions ---------- */

Object.assign(actions, {
  tab: (el) => { ui.haptic(); navigate(el.dataset.tab); },
  go: (el) => navigate(el.dataset.route, { section: el.dataset.section, seg: el.dataset.seg }),
  'go-guide': (el) => navigate('guide', { section: el.dataset.section }),
  'sheet-close': () => ui.closeSheet(),
});

/* ---------- Event delegation ---------- */

let swiped = false;

document.addEventListener('click', (e) => {
  if (swiped) { swiped = false; e.preventDefault(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  if (el.closest('#toast')) ui.hideToast();
  try {
    const result = fn(el, e);
    if (result && typeof result.catch === 'function') result.catch(reportError);
  } catch (err) {
    reportError(err);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  try {
    forms[form.dataset.form]?.(form, new FormData(form), e);
  } catch (err) {
    reportError(err);
  }
});

/** Text areas marked .grow get taller as you type instead of scrolling inside. */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

function syncEmpty(el) {
  if (el.classList?.contains('opt')) el.closest('.field')?.classList.toggle('is-empty', !el.value);
}

document.addEventListener('input', (e) => {
  syncEmpty(e.target);
  if (e.target.matches?.('textarea.grow')) autoGrow(e.target);
  const el = e.target.closest('[data-input]');
  if (el) inputs[el.dataset.input]?.(el, e);
});

document.addEventListener('change', (e) => {
  syncEmpty(e.target);
  const el = e.target.closest('[data-change]');
  if (el) {
    const result = changes[el.dataset.change]?.(el, e);
    if (result && typeof result.catch === 'function') result.catch(reportError);
  }
});

function reportError(err) {
  console.error(err);
  ui.toast(`Something went wrong: ${err?.message || err}`, { duration: 5000 });
}

/* ---------- Swipe a task: right to tick it off, left to delete ---------- */

let sw = null;

document.addEventListener('touchstart', (e) => {
  const row = e.target.closest('.row.task[data-id]');
  if (!row || e.touches.length !== 1 || row.closest('#sheet-root')) return;
  sw = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, locked: false };
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!sw) return;
  const dx = e.touches[0].clientX - sw.x;
  const dy = e.touches[0].clientY - sw.y;
  if (!sw.locked) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
    if (Math.abs(dx) < 12) return;
    sw.locked = true;
    sw.row.classList.add('swiping');
  }
  sw.dx = dx;
  sw.row.style.setProperty('--dx', `${dx}px`);
  sw.row.classList.toggle('sw-done', dx > 72);
  sw.row.classList.toggle('sw-del', dx < -72);
  sw.row.dataset.dir = dx > 0 ? 'r' : 'l';
}, { passive: true });

function endSwipe() {
  if (!sw) return;
  const { row, dx, locked } = sw;
  sw = null;
  if (!locked) return;
  swiped = true;
  setTimeout(() => { swiped = false; }, 350);
  row.classList.remove('swiping', 'sw-done', 'sw-del');
  row.style.removeProperty('--dx');
  if (dx > 72) tasks.swipeDone(row.dataset.id, row);
  else if (dx < -72) { ui.haptic(); tasks.swipeDelete(row.dataset.id); }
}
document.addEventListener('touchend', endSwipe, { passive: true });
document.addEventListener('touchcancel', endSwipe, { passive: true });

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('hb:save-failed', () => ui.toast('Couldn’t save. Your iPhone may be low on storage.', { duration: 5000 }));

/* ---------- Boot ---------- */

document.getElementById('tabbar').innerHTML = `<i class="tab-pill" aria-hidden="true"></i>${TABS.map(([id, label]) =>
  `<button class="tab tab-${id}" data-action="tab" data-tab="${id}"><span class="tab-ic">${ui.icon(id === 'plan' ? 'plan' : id === 'idp' ? 'idp' : id, 25)}</span><span class="tab-lbl">${label}</span></button>`,
).join('')}`;

ui.setRouter({ render, navigate, current: () => route });
health.init();
health.checkHashImport();
focus.init();
weather.init();
today.init();
render();
bus.startPolling();

// Redraw time-sensitive screens when coming back to the app or after midnight.
let lastDay = ui.dateKey();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const dayChanged = ui.dateKey() !== lastDay;
  lastDay = ui.dateKey();
  if (!ui.sheetIsOpen() && (dayChanged || ['today', 'plan', 'health'].includes(route))) render();
});
setInterval(() => {
  if (ui.dateKey() !== lastDay && !ui.sheetIsOpen()) {
    lastDay = ui.dateKey();
    render();
  }
}, 60000);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker not registered', err));
}
navigator.storage?.persist?.().catch(() => {});
window.addEventListener('beforeunload', saveNow);
