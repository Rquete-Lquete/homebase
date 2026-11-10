// Today: a live dashboard. The top card follows the timetable minute by minute;
// below it sit the weather, the focus timer, your buses, progress rings and
// whatever is due soon.

import { state, save, subjectColor } from './store.js';
import { esc, icon, fmtLongDate, fmtTime, fmtDur, fmtNum, dateKey, dayDiff, fmtDayAbs, isStandalone, refresh, ring, currentRoute, WEEKDAYS } from './ui.js';
import { groupTasks, taskRow } from './tasks.js';
import { nowNext, lessonsOn } from './timetable.js';
import * as bus from './bus.js';
import * as weather from './weather.js';
import * as focus from './focus.js';
import { upcomingDates } from './idp.js';

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Still up' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  return state.settings.name ? `${g}, ${state.settings.name}` : `Good ${g === 'Still up' ? 'night' : g.toLowerCase()}`;
}

/* ---------- The "now" card ---------- */

function heroHTML() {
  const n = nowNext();
  const open = state.tasks.filter((t) => !t.done);
  const today = dateKey();
  const dueToday = open.filter((t) => t.due && t.due <= today).length;

  if (!state.timetable.length) {
    return `<button class="hero plain" data-action="go" data-route="plan" data-seg="timetable">
      <span class="hero-kicker">Timetable</span><span class="hero-title">Add your lessons</span>
      <span class="hero-sub">This card will then show what’s on now, what’s next and how long is left.</span></button>`;
  }
  if (n.current) {
    const c = n.current;
    return `<button class="hero live" style="--subj:${subjectColor(c.subject)}" data-action="go" data-route="plan" data-seg="timetable">
      <span class="hero-kicker"><i class="pulse"></i>Now${c.room ? `, ${esc(c.room)}` : ''}</span>
      <span class="hero-title">${esc(c.subject)}</span>
      <span class="hero-sub">${esc(fmtDur(n.left))} left, ends ${esc(fmtTime(c.end))}</span>
      <span class="hero-bar"><i style="width:${Math.round(n.progress * 100)}%"></i></span>
      <span class="hero-next">${n.next ? `Next: ${esc(n.next.subject)} at ${esc(fmtTime(n.next.start))}${n.next.room ? `, ${esc(n.next.room)}` : ''}` : 'Last lesson of the day'}</span></button>`;
  }
  if (n.next) {
    const first = n.done === 0;
    return `<button class="hero next" style="--subj:${subjectColor(n.next.subject)}" data-action="go" data-route="plan" data-seg="timetable">
      <span class="hero-kicker">${first ? 'First lesson' : 'Break, then'}</span>
      <span class="hero-title">${esc(n.next.subject)}</span>
      <span class="hero-sub">${esc(fmtTime(n.next.start))}${n.next.room ? `, ${esc(n.next.room)}` : ''}. Starts in ${esc(fmtDur(n.until))}</span>
      <span class="hero-next">${n.list.length - n.done} lesson${n.list.length - n.done === 1 ? '' : 's'} left today</span></button>`;
  }
  // No more lessons today: look ahead to tomorrow's first one.
  const tomorrow = (new Date().getDay() + 1) % 7;
  const first = lessonsOn(tomorrow)[0];
  return `<button class="hero plain" data-action="go" data-route="plan" data-seg="tasks">
    <span class="hero-kicker">${n.list.length ? 'School’s done' : 'No lessons today'}</span>
    <span class="hero-title">${dueToday ? `${dueToday} thing${dueToday === 1 ? '' : 's'} due today` : open.length ? 'Nothing due today' : 'All clear'}</span>
    <span class="hero-sub">${first ? `${WEEKDAYS[tomorrow]} starts with ${esc(first.subject)} at ${esc(fmtTime(first.start))}.` : 'Nothing on the timetable tomorrow.'}</span></button>`;
}

/* ---------- Rings ---------- */

function ringsHTML() {
  const today = dateKey();
  const doneToday = state.tasks.filter((t) => t.done && t.doneAt && dateKey(new Date(t.doneAt)) === today).length;
  const openDue = state.tasks.filter((t) => !t.done && t.due && t.due <= today).length;
  const total = doneToday + openDue;
  const fMin = focus.minutesOn();
  const g = state.settings.goals;
  const steps = state.health.days[today]?.steps;
  const cell = (pct, color, value, label, sub, action, extra = '') => `<button class="ringcell" data-action="${action}"${extra}>
      <span class="ring-wrap">${ring(pct, { size: 76, stroke: 8, color, label: `${label}: ${sub}` })}<b>${value}</b></span>
      <span class="ring-label">${label}</span><span class="ring-sub">${sub}</span></button>`;
  return `<section class="section"><div class="rings">
    ${cell(total ? doneToday / total : 0, 'var(--tasks)', `<span data-count="${doneToday}">0</span>`, 'Tasks', total ? `of ${total} due` : 'none due', 'go', ' data-route="plan" data-seg="tasks"')}
    ${cell(fMin / (g.focus || 60), 'var(--led-ink)', `<span data-count="${fMin}">0</span>`, 'Focus', `of ${g.focus || 60} min`, 'focus-new')}
    ${cell(steps != null ? steps / g.steps : 0, 'var(--health)', steps != null ? `<span class="small-num">${steps >= 1000 ? `${fmtNum(steps / 1000, 1)}k` : fmtNum(steps)}</span>` : '–', 'Steps', steps != null ? `of ${fmtNum(g.steps)}` : 'tap to sync', 'tab', ' data-tab="health"')}
  </div></section>`;
}

/* ---------- Setup, buses, tasks, dates ---------- */

function setupCard() {
  const s = state.settings.setup;
  if (s.hideCard) return '';
  const steps = [
    { done: isStandalone(), label: 'Add Homebase to your Home Screen', section: 'home' },
    { done: s.reminder, label: 'Set up the reminders shortcut', section: 'reminders' },
    { done: Boolean(state.health.lastSync), label: 'Connect Apple Health', section: 'health' },
  ];
  const left = steps.filter((x) => !x.done);
  if (!left.length) return '';
  return `<section class="section"><div class="group setup">
    <div class="setup-head"><h2>Finish setting up <span class="count">${steps.length - left.length} of ${steps.length}</span></h2><button class="link" data-action="setup-hide">Hide</button></div>
    ${left.map((st) => `<button class="row-btn setup-row" data-action="go-guide" data-section="${st.section}">
      <span class="dot"></span><span class="setup-label">${esc(st.label)}</span>${icon('chevRight', 16)}</button>`).join('')}
  </div></section>`;
}

function tasksSection() {
  const open = state.tasks.filter((t) => !t.done);
  const today = dateKey();
  const g = groupTasks(open, today);
  let list = [...g.overdue, ...g.today, ...g.tomorrow];
  if (list.length < 3) list = list.concat(g.week.filter((t) => dayDiff(today, t.due) <= 3));
  const shown = list.slice(0, 5);
  const rows = shown.length ? shown.map(taskRow).join('')
    : `<p class="row-note">${open.length ? 'Nothing due in the next few days.' : 'No tasks yet. Add homework and tests to see what’s due.'}</p>`;
  return `<section class="section"><div class="section-head"><h2>Due soon</h2>
      <button class="link" data-action="go" data-route="plan" data-seg="tasks">${open.length > shown.length ? `All ${open.length}` : 'All tasks'}</button></div>
    <div class="group">${rows}<button class="row-btn add-row" data-action="task-new">${icon('plus', 20)}<span class="lbl">New task</span></button></div>
  </section>`;
}

function datesSection() {
  const list = upcomingDates(60).slice(0, 4);
  if (!list.length) return '';
  const today = dateKey();
  return `<section class="section"><div class="section-head"><h2>Coming up</h2><button class="link" data-action="tab" data-tab="idp">IDP</button></div>
    <div class="datechips">${list.map((d) => { const n = dayDiff(today, d.date); return `<button class="datechip${n <= 14 ? ' soon' : ''}" data-action="tab" data-tab="idp">
      <b>${n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`}</b><span>${esc(d.title)}</span><small>${esc(fmtDayAbs(d.date))}${d.kind ? `, ${d.kind}` : ''}</small></button>`; }).join('')}</div></section>`;
}

let firstPaint = true;

function render() {
  const head = `<header class="page-head today-head"><p class="kicker">${esc(fmtLongDate())}</p>
    <div class="head-row"><h1>${esc(greeting())}</h1>
    <div class="head-actions"><button class="icon-btn" data-action="go" data-route="settings" aria-label="Settings">${icon('sliders', 20)}</button></div></div></header>`;
  const evening = new Date().getHours() >= 18;
  const blocks = [
    `<div class="hero-slot" id="hero-slot">${heroHTML()}</div>`,
    `<div class="duo"><div data-wx-slot>${weather.tileHTML()}</div><div data-focus-slot>${focus.tileHTML()}</div></div>`,
    evening ? tasksSection() : bus.todaySection(),
    ringsHTML(),
    evening ? bus.todaySection() : tasksSection(),
    datesSection(),
    setupCard(),
  ];
  return `${head}<div class="today-stack${firstPaint ? ' enter' : ''}">${blocks.join('')}</div>`;
}

function mount() {
  firstPaint = false;
  weather.refreshTile();
}

/** Keeps the top card in step with the clock without redrawing the whole screen. */
export function init() {
  setInterval(() => {
    if (document.hidden || currentRoute() !== 'today') return;
    const slot = document.getElementById('hero-slot');
    if (slot) slot.innerHTML = heroHTML();
  }, 20000);
}

export const actions = {
  'setup-hide': () => { state.settings.setup.hideCard = true; save(); refresh(); },
};

export const view = { title: () => 'Today', render, mount };
