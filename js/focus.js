// Focus: a study timer. Pick a length and a subject, put the phone down, and
// the minutes are logged per subject. The timer runs off the clock, so it stays
// right even if Homebase is closed and reopened.

import { state, save, saveNow, subjects, subjectColor } from './store.js';
import { esc, icon, dateKey, addDays, fmtDur, toast, openSheet, closeSheet, refresh, currentRoute, haptic, confetti, pad } from './ui.js';

const PRESETS = [15, 25, 45, 60];
let ticker = 0;
let wakeLock = null;
let showing = false; // full-screen view open

const active = () => state.focus.active;

/* ---------- Stats ---------- */

export function minutesOn(key = dateKey()) {
  return state.focus.sessions.filter((s) => s.day === key).reduce((a, s) => a + s.min, 0);
}

/** Days in a row with at least one session, counting today or ending yesterday. */
export function streak() {
  const days = new Set(state.focus.sessions.map((s) => s.day));
  let d = new Date();
  if (!days.has(dateKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dateKey(d))) { n += 1; d = addDays(d, -1); }
  return n;
}

export function weekBySubject() {
  const from = dateKey(addDays(new Date(), -6));
  const by = new Map();
  for (const s of state.focus.sessions) if (s.day >= from) by.set(s.subject || 'General', (by.get(s.subject || 'General') || 0) + s.min);
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
}

/* ---------- Timer ---------- */

function remainingMs() {
  const a = active();
  if (!a) return 0;
  return a.pausedAt ? a.remaining : Math.max(0, a.end - Date.now());
}

const clock = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function log(minutes, a) {
  const min = Math.round(minutes);
  if (min < 1 || a.isBreak) return 0;
  state.focus.sessions.push({ day: dateKey(), min, subject: a.subject || '', at: Date.now() });
  if (state.focus.sessions.length > 1500) state.focus.sessions.splice(0, state.focus.sessions.length - 1500);
  return min;
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.55);
    });
  } catch { /* sound not allowed */ }
}

function start({ minutes, subject = '', taskId = '', isBreak = false }) {
  const duration = minutes * 60000;
  state.focus.active = { start: Date.now(), end: Date.now() + duration, duration, subject, taskId, isBreak, pausedAt: 0, remaining: 0 };
  if (!isBreak) state.focus.lastMinutes = minutes;
  saveNow();
  showing = true;
  paint();
  run();
  keepAwake(true);
}

function finish(completed) {
  const a = active();
  if (!a) return;
  const spent = (a.duration - (completed ? 0 : remainingMs())) / 60000;
  const logged = log(spent, a);
  state.focus.active = null;
  saveNow();
  clearInterval(ticker);
  keepAwake(false);
  if (completed) {
    chime(); haptic();
    showing = true;
    paintDone(a, logged);
    if (!a.isBreak) confetti(window.innerWidth / 2, window.innerHeight * 0.38);
  } else {
    showing = false;
    paint();
    if (logged) toast(`${fmtDur(logged)} of focus logged`);
  }
  if (['today', 'plan'].includes(currentRoute())) refresh();
}

function tick() {
  const a = active();
  if (!a) { clearInterval(ticker); return; }
  if (!a.pausedAt && a.end <= Date.now()) { finish(true); return; }
  const ms = remainingMs();
  const text = clock(ms);
  document.querySelectorAll('[data-focus-clock]').forEach((el) => { el.textContent = text; });
  const arc = document.querySelector('#focus-root .fr-arc');
  if (arc) arc.style.strokeDashoffset = String(Number(arc.dataset.c) * (ms / a.duration));
}

function run() {
  clearInterval(ticker);
  ticker = setInterval(tick, 250);
  tick();
}

/* ---------- Views ---------- */

const root = () => document.getElementById('focus-root');

function paint() {
  const el = root();
  const a = active();
  if (!el) return;
  document.body.classList.toggle('focus-mini', Boolean(a) && !showing);
  if (!a) { el.className = 'focus-root'; el.innerHTML = ''; return; }
  const color = a.isBreak ? '#30D158' : subjectColor(a.subject) === '#8E8E93' ? '#FFB000' : subjectColor(a.subject);
  if (!showing) {
    el.className = 'focus-root mini';
    el.innerHTML = `<button class="focus-pill" data-action="focus-show" style="--subj:${color}"><i></i><span>${a.isBreak ? 'Break' : esc(a.subject || 'Focus')}</span><b data-focus-clock>${clock(remainingMs())}</b></button>`;
    return;
  }
  const size = 280;
  const r = 128;
  const c = 2 * Math.PI * r;
  const task = a.taskId ? state.tasks.find((t) => t.id === a.taskId) : null;
  el.className = 'focus-root full';
  el.innerHTML = `<section class="focus-full" style="--subj:${color}" role="dialog" aria-label="Focus timer">
    <button class="focus-min" data-action="focus-hide" aria-label="Hide timer">${icon('minimize', 24)}</button>
    <p class="focus-kicker">${a.isBreak ? 'Break' : esc(a.subject || 'Focus')}</p>
    ${task ? `<p class="focus-task">${esc(task.title)}</p>` : ''}
    <div class="focus-ring${a.pausedAt ? ' paused' : ''}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="fr-track" cx="140" cy="140" r="${r}"/>
        <circle class="fr-arc" cx="140" cy="140" r="${r}" data-c="${c}" stroke-dasharray="${c}" stroke-dashoffset="${c * (remainingMs() / a.duration)}" transform="rotate(-90 140 140)"/>
      </svg>
      <div class="focus-time"><span data-focus-clock role="timer">${clock(remainingMs())}</span><small>${a.pausedAt ? 'Paused' : `of ${fmtDur(a.duration / 60000)}`}</small></div>
    </div>
    <div class="focus-actions">
      <button class="fbtn" data-action="focus-end"><span class="lbl">End</span></button>
      <button class="fbtn primary" data-action="focus-pause">${icon(a.pausedAt ? 'play' : 'pause', 22)}<span>${a.pausedAt ? 'Resume' : 'Pause'}</span></button>
    </div>
    <p class="focus-note">Leave Homebase open and the screen stays on. If you switch apps the timer keeps counting.</p>
  </section>`;
}

function paintDone(a, logged) {
  const el = root();
  document.body.classList.remove('focus-mini');
  el.className = 'focus-root full';
  el.innerHTML = `<section class="focus-full done" role="dialog" aria-label="Session finished">
    <p class="focus-kicker">${a.isBreak ? 'Break over' : 'Session done'}</p>
    <p class="focus-big">${a.isBreak ? 'Back to it' : esc(fmtDur(logged))}</p>
    <p class="focus-task">${a.isBreak ? '' : `${a.subject ? `${esc(a.subject)}. ` : ''}${esc(fmtDur(minutesOn()))} today, ${streak()}-day streak.`}</p>
    <div class="focus-actions col">
      ${a.isBreak ? `<button class="fbtn primary" data-action="focus-again" data-subject="${esc(a.subject)}">${icon('play', 20)}<span>Start ${state.focus.lastMinutes} min</span></button>`
        : `<button class="fbtn primary" data-action="focus-break">Take a 5 min break</button>`}
      ${a.taskId && !a.isBreak ? `<button class="fbtn" data-action="focus-task-done" data-id="${esc(a.taskId)}">Mark the task as done</button>` : ''}
      <button class="fbtn" data-action="focus-close">Close</button>
    </div></section>`;
}

function setupSheet({ subject = '', taskId = '' } = {}) {
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const subj = subject || task?.subject || '';
  const last = state.focus.lastMinutes || 25;
  return `<form data-form="focus-start" class="sheet-form" autocomplete="off">
    <input type="hidden" name="taskId" value="${esc(taskId)}">
    <div class="sheet-head"><button type="button" class="link" data-action="sheet-close">Cancel</button><h2>Focus</h2><span></span></div>
    ${task ? `<p class="sheet-sub">${esc(task.title)}</p>` : ''}
    <p class="group-label">How long?</p>
    <div class="segmented">${PRESETS.map((m) => `<label><input type="radio" name="minutes" value="${m}"${m === last ? ' checked' : ''}><span>${m} min</span></label>`).join('')}</div>
    <p class="group-label">Subject</p>
    <div class="pick-chips">${['', ...subjects().slice(0, 11)].map((s) => `<label><input type="radio" name="subject" value="${esc(s)}"${s === subj ? ' checked' : ''}><span>${s ? `<i style="background:${subjectColor(s)}"></i>${esc(s)}` : 'None'}</span></label>`).join('')}</div>
    <div class="sheet-pad"><button type="submit" class="btn btn-large btn-primary">${icon('play', 18)}Start</button></div>
  </form>`;
}

/* ---------- Pieces other screens show ---------- */

export function tileHTML() {
  const a = active();
  const today = minutesOn();
  const st = streak();
  if (a) {
    return `<button class="tile-btn focus-tile live" data-action="focus-show"><span class="tl-label">${a.isBreak ? 'Break' : esc(a.subject || 'Focus')}</span>
      <span class="tl-main clock" data-focus-clock>${clock(remainingMs())}</span><span class="tl-sub">${a.pausedAt ? 'Paused. Tap to open' : 'Running. Tap to open'}</span></button>`;
  }
  return `<button class="tile-btn focus-tile" data-action="focus-new"><span class="tl-top"><span class="play-dot">${icon('play', 20)}</span>${st > 1 ? `<span class="streak">${icon('flame', 16)}${st}</span>` : ''}</span>
    <span class="tl-main">Start focus</span>
    <span class="tl-sub">${today ? `${esc(fmtDur(today))} today` : 'Nothing logged today'}</span></button>`;
}

export function weekHTML() {
  const rows = weekBySubject();
  if (!rows.length) return '';
  const max = rows[0][1];
  const total = rows.reduce((a, r) => a + r[1], 0);
  return `<section class="section"><div class="section-head"><h2>Focus this week</h2><span class="count">${esc(fmtDur(total))}</span></div>
    <div class="group pad-group">${rows.slice(0, 6).map(([s, m]) => `<div class="hbar" style="--subj:${subjectColor(s === 'General' ? '' : s)}">
      <span class="hbar-name">${esc(s)}</span><span class="hbar-track"><i class="grow-bar" style="--w:${(m / max) * 100}%"></i></span><span class="hbar-val">${esc(fmtDur(m))}</span></div>`).join('')}</div></section>`;
}

export function init() {
  if (active()) {
    showing = false;
    paint();
    run();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (active()) { tick(); if (showing) keepAwake(true); }
  });
}

export const actions = {
  'focus-new': (el) => {
    if (active()) { showing = true; paint(); return; }
    openSheet(setupSheet({ subject: el.dataset.subject || '', taskId: el.dataset.id || '' }), { label: 'Focus' });
  },
  'focus-show': () => { showing = true; paint(); keepAwake(true); },
  'focus-hide': () => { showing = false; paint(); keepAwake(false); if (currentRoute() === 'today') refresh(); },
  'focus-pause': () => {
    const a = active();
    if (!a) return;
    if (a.pausedAt) { a.end = Date.now() + a.remaining; a.pausedAt = 0; a.remaining = 0; } else { a.remaining = remainingMs(); a.pausedAt = Date.now(); }
    saveNow(); haptic(); paint(); tick();
  },
  'focus-end': () => { haptic(); finish(false); },
  'focus-close': () => { showing = false; paint(); },
  'focus-break': () => start({ minutes: 5, isBreak: true }),
  'focus-again': (el) => start({ minutes: state.focus.lastMinutes || 25, subject: el.dataset.subject || '' }),
  'focus-task-done': (el) => {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (t) { t.done = true; t.doneAt = Date.now(); save(); }
    showing = false; paint(); refresh(); toast('Marked as done');
  },
};

export const forms = {
  'focus-start': (form, fd) => {
    closeSheet();
    start({ minutes: Number(fd.get('minutes')) || 25, subject: String(fd.get('subject') || ''), taskId: String(fd.get('taskId') || '') });
  },
};
