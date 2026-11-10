// Health: today's Apple Health numbers, brought in by the "Homebase Health"
// shortcut. The shortcut copies a few lines of text (see HEALTH_TEMPLATE);
// Homebase pastes them in and keeps a day-by-day history on this iPhone.

import { state, save } from './store.js';
import {
  esc, icon, pageHeader, dateKey, addDays, keyToDate, fmtAgo, fmtNum, fmtDayAbs, WEEKDAYS,
  toast, openSheet, closeSheet, sheetIsOpen, refresh, currentRoute,
} from './ui.js';
import { runShortcut } from './shortcuts.js';

const PENDING_KEY = 'hb.pendingHealth';

/* ---------- Parsing what the shortcut copied ---------- */

const KEYS = {
  steps: 'steps', step: 'steps',
  km: 'km', distance: 'km', dist: 'km',
  kcal: 'kcal', energy: 'kcal', active: 'kcal', move: 'kcal',
  ex: 'ex', exercise: 'ex', exmin: 'ex',
  rhr: 'rhr', resting: 'rhr', heart: 'rhr',
  sleep: 'sleep',
};

/** First number in a string, ignoring thousands separators ("8,123 steps" -> 8123). */
function firstNumber(s) {
  const cleaned = String(s).replace(/(\d)[,   ](?=\d{3}\b)/g, '$1');
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function parseQuantity(key, raw) {
  let n = firstNumber(raw);
  if (n == null) return null;
  const u = raw.toLowerCase();
  if (key === 'km') {
    if (/\bmi\b|mile/.test(u)) n *= 1.609344;
    else if (/\d\s*m\b/.test(u) && !/km/.test(u)) n /= 1000;
  }
  if (key === 'kcal' && /kj/.test(u)) n /= 4.184;
  if (key === 'ex') {
    if (/\bh(r|rs|our|ours)?\b/.test(u) && !/min/.test(u)) n *= 60;
    else if (/\bs(ec|ecs)?\b/.test(u)) n /= 60;
  }
  return n;
}

/** Sleep can arrive as seconds, minutes, hours, "7 hr 12 min" or "7:12". Returns hours. */
export function parseSleep(raw) {
  const u = String(raw).trim().toLowerCase().replace(/(\d)[,  ](?=\d{3}\b)/g, '$1');
  if (!u) return null;
  const clock = u.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60 + (clock[3] ? Number(clock[3]) / 3600 : 0);
  const h = u.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = u.match(/(\d+(?:\.\d+)?)\s*m(?!s)/);
  if (h || m) return (h ? Number(h[1]) : 0) + (m ? Number(m[1]) / 60 : 0);
  const sec = u.match(/(\d+(?:\.\d+)?)\s*s/);
  if (sec) return Number(sec[1]) / 3600;
  const n = firstNumber(u);
  if (n == null) return null;
  if (n > 1440) return n / 3600; // seconds
  if (n > 24) return n / 60; // minutes
  return n; // hours
}

/**
 * Accepts lines like "steps=8,123" or "steps@2026-11-09=10234" (a specific day).
 * Returns { 'YYYY-MM-DD': { steps, km, kcal, ex, rhr, sleep } }.
 */
export function parseHealth(text, now = new Date()) {
  const body = String(text || '');
  if (!/^\s*HB1\b/im.test(body) && !/\bsteps\s*[=:]/i.test(body)) {
    throw new Error('The clipboard doesn’t have Health numbers from your shortcut. Run it again, then paste.');
  }
  const today = dateKey(now);
  const out = {};
  for (const rawLine of body.split(/\r?\n|;/)) {
    const line = rawLine.trim();
    const m = line.match(/^([a-z]+)(?:@(\d{4}-\d{2}-\d{2}))?\s*[=:]\s*(.*)$/i);
    if (!m) continue;
    const key = KEYS[m[1].toLowerCase()];
    if (!key) continue;
    const value = key === 'sleep' ? parseSleep(m[3]) : parseQuantity(key, m[3]);
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    if ((key === 'sleep' || key === 'rhr') && value === 0) continue;
    const day = m[2] || today;
    (out[day] ||= {})[key] = value;
  }
  if (!Object.keys(out).length) {
    throw new Error('Found your shortcut’s text but no numbers in it. Check that each line has a value after the = sign.');
  }
  return out;
}

export function importHealth(text) {
  const days = parseHealth(text);
  for (const [k, v] of Object.entries(days)) {
    state.health.days[k] = { ...(state.health.days[k] || {}), ...v, at: Date.now() };
  }
  // Keep roughly a year of history.
  const keys = Object.keys(state.health.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete state.health.days[k];
  state.health.lastSync = Date.now();
  save();
  return days;
}

/* ---------- Formatting ---------- */

function hoursParts(h) {
  const total = Math.round(h * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

const fmtHoursText = (h) => {
  const { h: hh, m } = hoursParts(h);
  return m ? `${hh} h ${m} min` : `${hh} h`;
};

const METRICS = [
  { key: 'steps', label: 'Steps', goal: 'steps', unit: '', digits: 0, chart: true, short: 'steps' },
  { key: 'ex', label: 'Exercise', goal: 'exercise', unit: 'min', digits: 0, chart: true, short: 'min' },
  { key: 'sleep', label: 'Sleep', goal: 'sleep', unit: '', digits: 1, chart: true, short: 'h' },
  { key: 'kcal', label: 'Active energy', unit: 'kcal', digits: 0 },
  { key: 'km', label: 'Distance', unit: 'km', digits: 1 },
  { key: 'rhr', label: 'Resting heart rate', unit: 'bpm', digits: 0 },
];

function valueHTML(metric, v) {
  if (metric.key === 'sleep') {
    const { h, m } = hoursParts(v);
    return `${h}<span class="u">h</span> ${m}<span class="u">m</span>`;
  }
  return `${fmtNum(v, metric.digits)}${metric.unit ? `<span class="u">${metric.unit}</span>` : ''}`;
}

function goalText(metric, goal) {
  if (metric.key === 'sleep') return `of ${fmtNum(goal, 1)} h`;
  if (metric.key === 'ex') return `of ${fmtNum(goal)} min`;
  return `of ${fmtNum(goal)}`;
}

/* ---------- Week chart (single series, one hue, inline SVG) ---------- */

let chartMetric = sessionStorage.getItem('hb.chartMetric') || 'steps';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (s * p >= v) return s * p;
  return 10 * p;
}

function tickLabel(metric, v) {
  if (metric.key === 'sleep') return `${fmtNum(v, 1)} h`;
  if (v >= 1000) return `${fmtNum(v / 1000, 1)}K`;
  return fmtNum(v);
}

function pointLabel(metric, v) {
  if (metric.key === 'sleep') return fmtHoursText(v);
  if (metric.key === 'ex') return `${fmtNum(v)} min`;
  return `${fmtNum(v)} steps`;
}

/** Bar with a 4px rounded top and a square base. */
function barPath(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function weekChart() {
  const metric = METRICS.find((m) => m.key === chartMetric) || METRICS[0];
  const keys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(new Date(), i - 6)));
  const values = keys.map((k) => state.health.days[k]?.[metric.key] ?? null);
  const goal = state.settings.goals[metric.goal];
  const W = 340;
  const H = 176;
  const left = 4;
  const right = 40;
  const top = 22;
  const bottom = 24;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const max = niceMax(Math.max(goal || 0, ...values.filter((v) => v != null), 1) * 1.04);
  const y = (v) => top + plotH - (v / max) * plotH;
  const slot = plotW / 7;
  const bw = Math.min(24, slot * 0.56);
  const lastIdx = values.reduce((acc, v, i) => (v != null ? i : acc), -1);

  const grid = [0, max / 2, max].map((v) =>
    `<line class="grid" x1="${left}" x2="${left + plotW}" y1="${y(v)}" y2="${y(v)}"/>` +
    `<text class="tick" x="${W - 2}" y="${y(v) + 4}" text-anchor="end">${esc(tickLabel(metric, v))}</text>`).join('');

  const goalLine = goal ? `<line class="goal" x1="${left}" x2="${left + plotW}" y1="${y(goal)}" y2="${y(goal)}"/>` : '';

  const cols = keys.map((k, i) => {
    const v = values[i];
    const x = left + slot * i + (slot - bw) / 2;
    const isToday = i === 6;
    const dayLabel = isToday ? 'Today' : WEEKDAYS[keyToDate(k).getDay()].slice(0, 3);
    const label = `${fmtDayAbs(k)}: ${v == null ? 'no data' : pointLabel(metric, v)}`;
    const bar = v != null && v > 0 ? `<path class="bar" d="${barPath(x, y(v), bw, top + plotH - y(v))}"/>` : '';
    const valueLabel = i === lastIdx && v != null && v > 0
      ? `<text class="val" x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle">${esc(tickLabel(metric, v))}</text>` : '';
    return `<g class="col" tabindex="0" role="img" aria-label="${esc(label)}" data-tip="${esc(label)}" data-x="${(left + slot * i + slot / 2) / W}">
      <rect class="hit" x="${left + slot * i}" y="${top - 18}" width="${slot}" height="${plotH + 18}"/>${bar}${valueLabel}
      <text class="day${isToday ? ' today' : ''}" x="${left + slot * i + slot / 2}" y="${H - 6}" text-anchor="middle">${dayLabel}</text></g>`;
  }).join('');

  const rows = keys.map((k, i) => `<tr><th scope="row">${esc(fmtDayAbs(k))}</th><td>${values[i] == null ? '–' : esc(pointLabel(metric, values[i]))}</td></tr>`).join('');
  const seg = METRICS.filter((m) => m.chart).map((m) =>
    `<button class="${m.key === metric.key ? 'on' : ''}" data-action="health-chart" data-metric="${m.key}" aria-pressed="${m.key === metric.key}">${m.label}</button>`).join('');

  return `<section class="section">
    <div class="section-head"><h2>Last 7 days</h2></div>
    <div class="chart-card">
      <div class="segmented buttons" role="group" aria-label="Chart">${seg}</div>
      <p class="chart-note">${esc(metric.label)}${goal ? `, goal ${esc(goalText(metric, goal).replace('of ', ''))}` : ''}. Tap a bar for its value.</p>
      <div class="chart" data-chart>
        <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(metric.label)} for the last 7 days">${grid}${goalLine}${cols}</svg>
        <div class="tooltip" role="status" aria-live="polite"></div>
      </div>
      <details class="table-view"><summary>Show as a list</summary><table><tbody>${rows}</tbody></table></details>
    </div></section>`;
}

/* ---------- Screens ---------- */

function latestDayKey() {
  return Object.keys(state.health.days).sort().pop() || null;
}

function render() {
  const { lastSync } = state.health;
  const syncBtn = `<button class="btn btn-health" data-action="health-sync">${icon('refresh', 16)}Sync</button>`;
  const head = pageHeader('Health', { right: syncBtn, sub: lastSync ? `Synced ${esc(fmtAgo(lastSync))}` : 'Not synced yet' });
  const today = dateKey();
  const key = state.health.days[today] ? today : latestDayKey();
  if (!key) {
    return `${head}<div class="empty">
      <p class="empty-title">Bring in Apple Health</p>
      <p>A web app can’t read Apple Health directly, so a shortcut does it. It reads today’s steps, exercise, sleep and more, then you paste the numbers here.</p>
      <button class="btn btn-primary" data-action="go-guide" data-section="health">Set up the Health shortcut</button>
      <button class="btn btn-plain" data-action="health-sync">I’ve set it up. Sync now</button></div>`;
  }
  const d = state.health.days[key];
  const notToday = key !== today
    ? `<p class="notice">Showing ${esc(fmtDayAbs(key))}. Tap Sync to bring in today.</p>` : '';
  const goals = state.settings.goals;
  const goalTile = (m, wide = false) => {
    const v = d[m.key];
    const goal = goals[m.goal];
    const pct = v != null && goal ? Math.min(100, (v / goal) * 100) : 0;
    return `<div class="tile${wide ? ' wide' : ''}">
      <span class="tile-label">${m.label}</span>
      <span class="tile-value">${v == null ? '<span class="u">No data</span>' : valueHTML(m, v)}</span>
      <span class="tile-sub">${v == null ? '&nbsp;' : esc(goalText(m, goal))}</span>
      <span class="meter" role="progressbar" aria-label="${m.label} goal" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>
    </div>`;
  };
  const mini = (m) => `<div class="mini"><span class="mini-label">${m.label}</span>
    <span class="mini-value">${d[m.key] == null ? '–' : valueHTML(m, d[m.key])}</span></div>`;
  const byKey = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  return `${head}${notToday}
    <div class="tiles">${goalTile(byKey.steps, true)}${goalTile(byKey.ex)}${goalTile(byKey.sleep)}</div>
    <div class="group stats-row"><div class="mini-stats">${['kcal', 'km', 'rhr'].map((k) => mini(byKey[k])).join('')}</div></div>
    <div class="group stats-row"><button class="row-btn" data-action="health-open-paste">${icon('paste', 20)}<span class="lbl">Paste numbers from the shortcut</span></button></div>
    ${weekChart()}
    <p class="credit">Your Health numbers stay on this iPhone. Change daily goals in Settings.</p>`;
}

function mount(root) {
  const chart = root.querySelector('[data-chart]');
  if (!chart) return;
  const tip = chart.querySelector('.tooltip');
  const show = (col) => {
    if (!col) return;
    chart.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
    col.classList.add('active');
    tip.textContent = col.dataset.tip;
    tip.style.left = `${Number(col.dataset.x) * 100}%`;
    tip.classList.add('show');
  };
  const hide = () => {
    tip.classList.remove('show');
    chart.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
  };
  chart.addEventListener('pointerdown', (e) => show(e.target.closest('.col')));
  chart.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') show(e.target.closest('.col')); });
  chart.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  chart.addEventListener('focusin', (e) => show(e.target.closest('.col')));
  chart.addEventListener('focusout', hide);
}

/** Compact numbers for the Today screen. */
export function todaySection() {
  const today = dateKey();
  const d = state.health.days[today];
  if (!state.health.lastSync) {
    return `<section class="section"><div class="section-head"><h2>Health</h2></div>
      <div class="group"><button class="row-btn cta" data-action="go-guide" data-section="health">
        <span class="cta-ic cta-health">${icon('health', 20)}</span>
        <span class="cta-text"><span class="cta-title">Connect Apple Health</span><span class="cta-sub">Steps, exercise and sleep, synced with a shortcut.</span></span>
        ${icon('chevRight', 16)}</button></div></section>`;
  }
  const g = state.settings.goals;
  const stat = (label, html, pct) => `<div class="mini">
      <span class="mini-label">${label}</span><span class="mini-value">${html}</span>
      ${pct != null ? `<span class="meter thin"><i style="width:${Math.min(100, pct)}%"></i></span>` : ''}</div>`;
  const body = d
    ? stat('Steps', d.steps != null ? fmtNum(d.steps) : '–', d.steps != null ? (d.steps / g.steps) * 100 : 0) +
      stat('Exercise', d.ex != null ? `${fmtNum(d.ex)}<span class="u">min</span>` : '–', d.ex != null ? (d.ex / g.exercise) * 100 : 0) +
      stat('Sleep', d.sleep != null ? valueHTML(METRICS[2], d.sleep) : '–', d.sleep != null ? (d.sleep / g.sleep) * 100 : 0)
    : '<p class="mini-empty">Nothing synced today yet.</p>';
  return `<section class="section"><div class="section-head"><h2>Health</h2>
      <button class="link" data-action="health-sync">Sync</button></div>
    <div class="group"><button class="mini-stats" data-action="tab" data-tab="health" aria-label="Open Health">${body}</button></div>
    <p class="hint section-hint">Synced ${esc(fmtAgo(state.health.lastSync))}</p></section>`;
}

/* ---------- Sync and paste ---------- */

function pasteSheetHTML(message = '') {
  return `<div class="sheet-head"><button class="link" data-action="sheet-close">Cancel</button><h2>Add Health data</h2><span></span></div>
    <div class="sheet-pad">
      <p class="sheet-text">Your “${esc(state.settings.healthShortcut)}” shortcut copied today’s numbers. Tap Paste to add them.</p>
      <button class="btn btn-large btn-health-solid" data-action="health-paste">${icon('paste', 20)}Paste</button>
      ${message ? `<p class="error" role="alert">${esc(message)}</p>` : ''}
      <details class="manual"><summary>Paste it by hand instead</summary>
        <textarea id="health-manual" class="field-input boxed" rows="6" placeholder="Touch and hold here, then tap Paste" aria-label="Health text"></textarea>
        <button class="btn btn-primary" data-action="health-manual">Add these numbers</button>
      </details>
    </div>`;
}

function finishImport(text) {
  const days = importHealth(text);
  localStorage.removeItem(PENDING_KEY);
  closeSheet();
  refresh();
  const n = Object.keys(days).length;
  toast(n === 1 ? 'Health numbers added' : `Health numbers added for ${n} days`);
}

/** Called when Homebase becomes visible again after the shortcut ran. */
function checkPending() {
  const pending = Number(localStorage.getItem(PENDING_KEY) || 0);
  if (!pending) return;
  if (Date.now() - pending > 15 * 60000) {
    localStorage.removeItem(PENDING_KEY);
    return;
  }
  if (!sheetIsOpen()) openSheet(pasteSheetHTML(), { label: 'Add Health data' });
}

/** Imports data passed in the URL as #hb=... (if a shortcut ever opens Homebase that way). */
export function checkHashImport() {
  const h = window.location.hash;
  if (!h.startsWith('#hb=')) return;
  let text = h.slice(4);
  try { text = decodeURIComponent(text); } catch { /* use as-is */ }
  history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    importHealth(text);
    localStorage.removeItem(PENDING_KEY);
    toast('Health numbers added');
  } catch (err) {
    toast(err.message, { duration: 5000 });
  }
}

export function init() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(checkPending, 250);
  });
  window.addEventListener('hashchange', () => {
    checkHashImport();
    if (currentRoute() === 'health' || currentRoute() === 'today') refresh();
  });
}

export const actions = {
  'health-sync': () => {
    localStorage.setItem(PENDING_KEY, String(Date.now()));
    runShortcut(state.settings.healthShortcut);
  },

  'health-paste': async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      const details = document.querySelector('#sheet-root details.manual');
      if (details) details.open = true;
      toast('Couldn’t read the clipboard. Paste the text into the box instead.', { duration: 4500 });
      return;
    }
    try {
      finishImport(text);
    } catch (err) {
      openSheet(pasteSheetHTML(err.message), { label: 'Add Health data' });
    }
  },

  'health-manual': () => {
    const text = document.getElementById('health-manual')?.value || '';
    try {
      finishImport(text);
    } catch (err) {
      toast(err.message, { duration: 5000 });
    }
  },

  'health-open-paste': () => openSheet(pasteSheetHTML(), { label: 'Add Health data' }),

  'health-chart': (el) => {
    chartMetric = el.dataset.metric;
    sessionStorage.setItem('hb.chartMetric', chartMetric);
    refresh();
  },
};

export const view = { title: () => 'Health', render, mount };
