// Today: the glance screen. Buses first in the morning, tasks first in the evening.

import { state, save } from './store.js';
import { esc, icon, fmtLongDate, dateKey, dayDiff, isStandalone, refresh } from './ui.js';
import { groupTasks, taskRow } from './tasks.js';
import * as bus from './bus.js';
import * as health from './health.js';
import * as portfolio from './portfolio.js';

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return state.settings.name ? `${g}, ${state.settings.name}` : g;
}

function setupCard() {
  const s = state.settings.setup;
  if (s.hideCard) return '';
  const steps = [
    { done: isStandalone(), label: 'Add Homebase to your Home Screen', section: 'home' },
    { done: s.reminder, label: 'Set up the reminders shortcut', section: 'reminders' },
    { done: Boolean(state.health.lastSync), label: 'Connect Apple Health', section: 'health' },
  ];
  if (steps.every((x) => x.done)) return '';
  return `<section class="section"><div class="group setup">
    <div class="setup-head"><h2>Finish setting up</h2><button class="link" data-action="setup-hide">Hide</button></div>
    ${steps.map((st) => `<button class="row-btn setup-row${st.done ? ' done' : ''}" data-action="go-guide" data-section="${st.section}">
      <span class="dot">${st.done ? icon('check', 13) : ''}</span><span class="setup-label">${esc(st.label)}${st.done ? '<span class="sr"> (done)</span>' : ''}</span>${icon('chevRight', 16)}</button>`).join('')}
  </div></section>`;
}

function tasksSection() {
  const open = state.tasks.filter((t) => !t.done);
  const today = dateKey();
  const g = groupTasks(open, today);
  let list = [...g.overdue, ...g.today, ...g.tomorrow];
  if (list.length < 3) list = list.concat(g.week.filter((t) => dayDiff(today, t.due) <= 3));
  const shown = list.slice(0, 6);
  const more = open.length - shown.length;
  const rows = shown.length
    ? shown.map(taskRow).join('')
    : `<p class="row-note">${open.length ? 'Nothing due in the next few days.' : 'No tasks yet. Add your homework and tests to see what’s due.'}</p>`;
  return `<section class="section"><div class="section-head"><h2>Due soon</h2>
      <button class="link" data-action="tab" data-tab="tasks">${more > 0 ? `All tasks (${open.length})` : 'All tasks'}</button></div>
    <div class="group">${rows}<button class="row-btn add-row" data-action="task-new">${icon('plus', 20)}<span class="lbl">New task</span></button></div>
  </section>`;
}

function render() {
  const head = `<header class="page-head today-head"><p class="kicker">${esc(fmtLongDate())}</p>
    <div class="head-row"><h1>${esc(greeting())}</h1>
    <div class="head-actions"><button class="icon-btn" data-action="go" data-route="settings" aria-label="Settings">${icon('sliders', 20)}</button></div></div></header>`;
  const sections = {
    bus: bus.todaySection(),
    tasks: tasksSection(),
    health: health.todaySection(),
    folio: portfolio.todaySection(),
  };
  const order = new Date().getHours() >= 18 ? ['tasks', 'bus', 'health', 'folio'] : ['bus', 'tasks', 'health', 'folio'];
  return head + setupCard() + order.map((k) => sections[k]).join('');
}

export const actions = {
  'setup-hide': () => {
    state.settings.setup.hideCard = true;
    save();
    refresh();
  },
};

export const view = { title: () => 'Today', render };
