// Tasks: homework, tests, projects and personal to-dos with due dates.
// "Remind me" hands the task to Apple Reminders through a shortcut, so the
// iPhone alerts you even when Homebase is closed.

import { state, save, uid } from './store.js';
import {
  esc, icon, pageHeader, dateKey, keyToDate, addDays, dayDiff, fmtDay, fmtDayAbs, fmtTime,
  toLocalInput, toast, openSheet, closeSheet, refresh, armed,
} from './ui.js';
import { sendReminder } from './shortcuts.js';

export const TYPES = [
  { id: 'homework', label: 'Homework', plural: 'Homework' },
  { id: 'test', label: 'Test', plural: 'Tests' },
  { id: 'project', label: 'Project', plural: 'Projects' },
  { id: 'personal', label: 'Personal', plural: 'Personal' },
];
const typeLabel = (id) => (TYPES.find((t) => t.id === id) || TYPES[0]).label;

const GROUPS = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['tomorrow', 'Tomorrow'],
  ['week', 'Next 7 days'],
  ['later', 'Later'],
  ['nodate', 'No due date'],
];

let filter = sessionStorage.getItem('hb.taskFilter') || 'all';
let showDone = false;
let refreshTimer = 0;

export function groupTasks(list, today = dateKey()) {
  const g = { overdue: [], today: [], tomorrow: [], week: [], later: [], nodate: [] };
  for (const t of list) {
    if (!t.due) { g.nodate.push(t); continue; }
    const n = dayDiff(today, t.due);
    if (n < 0) g.overdue.push(t);
    else if (n === 0) g.today.push(t);
    else if (n === 1) g.tomorrow.push(t);
    else if (n <= 7) g.week.push(t);
    else g.later.push(t);
  }
  const byDue = (a, b) =>
    (a.due || '9999').localeCompare(b.due || '9999') ||
    (a.time || '99:99').localeCompare(b.time || '99:99') ||
    a.createdAt - b.createdAt;
  Object.values(g).forEach((arr) => arr.sort(byDue));
  return g;
}

function dueHTML(t) {
  if (!t.due) return '';
  const n = dayDiff(dateKey(), t.due);
  const cls = t.done ? 'due' : n < 0 ? 'due overdue' : n === 0 ? 'due soon' : 'due';
  return `<span class="${cls}">${esc(fmtDay(t.due))}${t.time ? ` ${esc(fmtTime(t.time))}` : ''}</span>`;
}

export function taskRow(t) {
  const meta = [
    `<span class="tag tag-${esc(t.type)}">${esc(typeLabel(t.type))}</span>`,
    t.subject ? `<span class="subj">${esc(t.subject)}</span>` : '',
    dueHTML(t),
    t.remindAt && !t.done ? `<span class="rem" title="Reminder set">${icon('bell', 14)}<span class="sr">Reminder set</span></span>` : '',
  ].filter(Boolean).join('');
  return `<div class="row task${t.done ? ' is-done' : ''}" data-id="${esc(t.id)}">
    <button class="check" data-action="task-toggle" data-id="${esc(t.id)}" aria-pressed="${t.done}"
      aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}: ${esc(t.title)}">${icon('check', 16)}</button>
    <button class="row-main" data-action="task-edit" data-id="${esc(t.id)}">
      <span class="t-title">${esc(t.title)}</span>
      <span class="t-meta">${meta}</span>
    </button>
  </div>`;
}

function render() {
  const matches = (t) => filter === 'all' || t.type === filter;
  const open = state.tasks.filter((t) => !t.done && matches(t));
  const done = state.tasks.filter((t) => t.done && matches(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const groups = groupTasks(open);

  const chips = [{ id: 'all', plural: 'All' }, ...TYPES].map((c) =>
    `<button class="chip${filter === c.id ? ' on' : ''}" data-action="task-filter" data-filter="${c.id}" aria-pressed="${filter === c.id}">${esc(c.plural)}</button>`,
  ).join('');

  let body = '';
  for (const [key, label] of GROUPS) {
    if (!groups[key].length) continue;
    body += `<section class="section">
      <div class="section-head"><h2${key === 'overdue' ? ' class="h-overdue"' : ''}>${label}</h2><span class="count">${groups[key].length}</span></div>
      <div class="group">${groups[key].map(taskRow).join('')}</div></section>`;
  }

  if (!open.length) {
    body += `<div class="empty">
      <p class="empty-title">${filter === 'all' ? 'Nothing due' : `No ${esc(TYPES.find((t) => t.id === filter)?.plural.toLowerCase() || 'tasks')} due`}</p>
      <p>Add homework, tests and projects with their due dates. Turn on Remind me and Apple Reminders will alert you on time.</p>
      <button class="btn btn-primary" data-action="task-new">New task</button></div>`;
  }

  if (done.length) {
    body += `<section class="section">
      <button class="section-toggle" data-action="task-showdone" aria-expanded="${showDone}">
        <h2>Completed</h2><span class="count">${done.length}</span>${icon(showDone ? 'chevDown' : 'chevRight', 18)}</button>
      ${showDone ? `<div class="group">${done.slice(0, 60).map(taskRow).join('')}</div>
        <div class="group gap-top"><button class="row-btn danger" data-action="task-clear-done"><span class="lbl">Clear completed tasks</span></button></div>` : ''}
    </section>`;
  }

  return pageHeader('Tasks', { right: `<button class="icon-btn" data-action="task-new" aria-label="New task">${icon('plus', 22)}</button>` }) +
    `<div class="chips" role="toolbar" aria-label="Filter tasks">${chips}</div>${body}`;
}

/* ---------- Add / edit sheet ---------- */

/** Night before at 8 pm, else the due day at 7 am, else an hour from now. */
export function defaultRemind(due, time) {
  const now = new Date();
  let at = null;
  if (due) {
    const day = keyToDate(due);
    const eve = addDays(day, -1);
    eve.setHours(20, 0, 0, 0);
    const morning = new Date(day);
    morning.setHours(7, 0, 0, 0);
    if (eve > now) at = eve;
    else if (morning > now) at = morning;
    else if (time) {
      const [h, m] = time.split(':').map(Number);
      const before = new Date(day);
      before.setHours(h, m - 60, 0, 0);
      if (before > now) at = before;
    }
  }
  if (!at) {
    at = new Date(now.getTime() + 60 * 60000);
    at.setMinutes(at.getMinutes() < 30 ? 30 : 60, 0, 0);
  }
  return toLocalInput(at);
}

function taskSheet(task, prefill = {}) {
  const isNew = !task;
  const t = task || { title: '', type: 'homework', subject: '', due: '', time: '', notes: '', remindAt: '', ...prefill };
  const subjects = [...new Set(state.tasks.map((x) => x.subject).filter(Boolean))].sort();
  const remindValue = t.remindAt || defaultRemind(t.due, t.time);
  return `<form data-form="task-save" class="sheet-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(t.id || '')}">
    <div class="sheet-head">
      <button type="button" class="link" data-action="sheet-close">Cancel</button>
      <h2>${isNew ? 'New task' : 'Edit task'}</h2>
      <button type="submit" class="link strong">${isNew ? 'Add' : 'Done'}</button>
    </div>
    <div class="group"><input class="field-input big" name="title" required maxlength="140" placeholder="What needs doing?" value="${esc(t.title)}" enterkeyhint="done" aria-label="Task"></div>
    <div class="segmented" role="radiogroup" aria-label="Type">${TYPES.map((x) =>
      `<label><input type="radio" name="type" value="${x.id}"${t.type === x.id ? ' checked' : ''}><span>${x.label}</span></label>`).join('')}</div>
    <div class="group">
      <label class="field"><span>Subject</span><input name="subject" list="subject-list" maxlength="40" placeholder="Chemistry" value="${esc(t.subject)}"></label>
      <datalist id="subject-list">${subjects.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      <label class="field${t.due ? '' : ' is-empty'}"><span>Due</span><input class="opt" type="date" name="due" value="${esc(t.due)}" data-change="task-due"></label>
      <label class="field${t.time ? '' : ' is-empty'}"><span>Time</span><input class="opt" type="time" name="time" value="${esc(t.time)}" data-change="task-due"></label>
    </div>
    <div class="group"><textarea class="field-input" name="notes" rows="3" maxlength="1000" placeholder="Notes" aria-label="Notes">${esc(t.notes)}</textarea></div>
    <div class="group">
      <label class="field"><span>Remind me</span><span class="switch"><input type="checkbox" name="remind"${t.remindAt ? ' checked' : ''} data-change="task-remind"><span></span></span></label>
      <label class="field remind-at"${t.remindAt ? '' : ' hidden'}><span>At</span><input type="datetime-local" name="remindAt" value="${esc(remindValue)}" data-input="task-remind-at"${t.remindAt ? ' data-touched="1"' : ''}></label>
    </div>
    <p class="hint">Reminders go to Apple Reminders through your “${esc(state.settings.reminderShortcut)}” shortcut. <button type="button" class="inline-link" data-action="go-guide" data-section="reminders">How to set it up</button></p>
    ${isNew ? '' : `<div class="group">
      ${t.remindAt ? `<button type="button" class="row-btn" data-action="task-remind-again" data-id="${esc(t.id)}">${icon('bell', 20)}<span class="lbl">Add to Reminders again</span></button>` : ''}
      <button type="button" class="row-btn danger" data-action="task-delete" data-id="${esc(t.id)}">${icon('trash', 20)}<span class="lbl">Delete task</span></button>
    </div>`}
  </form>`;
}

export function openNewTask(prefill = {}) {
  openSheet(taskSheet(null, prefill), { label: 'New task' });
}

function fireReminder(task) {
  const at = new Date(task.remindAt);
  if (Number.isNaN(at.getTime())) return;
  const due = task.due ? `Due ${fmtDayAbs(task.due)}${task.time ? ` ${fmtTime(task.time)}` : ''}` : '';
  sendReminder({ title: task.title, notes: [task.subject, due].filter(Boolean).join(', '), at });
}

/* ---------- Event handlers ---------- */

export const actions = {
  'task-new': () => openNewTask(),

  'task-edit': (el) => {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (t) openSheet(taskSheet(t), { label: 'Edit task' });
  },

  'task-filter': (el) => {
    filter = el.dataset.filter;
    sessionStorage.setItem('hb.taskFilter', filter);
    refresh();
  },

  'task-toggle': (el) => {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : 0;
    save();
    el.closest('.task')?.classList.toggle('is-done', t.done);
    el.setAttribute('aria-pressed', String(t.done));
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 700);
    if (t.done) toast('Marked as done', { action: 'task-undo', actionLabel: 'Undo', data: { id: t.id } });
  },

  'task-undo': (el) => {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    t.done = false;
    t.doneAt = 0;
    save();
    clearTimeout(refreshTimer);
    refresh();
  },

  'task-showdone': () => {
    showDone = !showDone;
    refresh();
  },

  'task-clear-done': (el) => {
    if (!armed(el, 'Tap again to clear')) return;
    const n = state.tasks.filter((t) => t.done).length;
    state.tasks = state.tasks.filter((t) => !t.done);
    save();
    refresh();
    toast(`Cleared ${n} completed task${n === 1 ? '' : 's'}`);
  },

  'task-delete': (el) => {
    if (!armed(el, 'Tap again to delete')) return;
    state.tasks = state.tasks.filter((t) => t.id !== el.dataset.id);
    save();
    closeSheet();
    refresh();
    toast('Task deleted');
  },

  'task-remind-again': (el) => {
    const t = state.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    closeSheet();
    fireReminder(t);
  },
};

export const changes = {
  'task-remind': (el) => {
    const row = el.form.querySelector('.remind-at');
    row.hidden = !el.checked;
    const input = row.querySelector('input');
    if (el.checked && !input.dataset.touched) {
      input.value = defaultRemind(el.form.elements.due.value, el.form.elements.time.value);
    }
  },
  'task-due': (el) => {
    const form = el.form;
    const input = form.querySelector('[name="remindAt"]');
    if (form.elements.remind.checked && !input.dataset.touched) {
      input.value = defaultRemind(form.elements.due.value, form.elements.time.value);
    }
  },
};

export const inputs = {
  'task-remind-at': (el) => { el.dataset.touched = '1'; },
};

export const forms = {
  'task-save': (form, fd) => {
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    const data = {
      title,
      type: TYPES.some((x) => x.id === fd.get('type')) ? fd.get('type') : 'homework',
      subject: String(fd.get('subject') || '').trim(),
      due: String(fd.get('due') || ''),
      time: String(fd.get('time') || ''),
      notes: String(fd.get('notes') || '').trim(),
    };
    const remindAt = fd.get('remind') === 'on' ? String(fd.get('remindAt') || '') : '';
    const id = fd.get('id');
    let task;
    let sendIt = false;
    if (id) {
      task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      sendIt = Boolean(remindAt) && remindAt !== task.remindAt;
      Object.assign(task, data, { remindAt });
    } else {
      task = { id: uid(), ...data, remindAt, done: false, doneAt: 0, createdAt: Date.now() };
      state.tasks.push(task);
      sendIt = Boolean(remindAt);
    }
    save();
    closeSheet();
    refresh();
    if (sendIt) fireReminder(task);
    else toast(id ? 'Task updated' : 'Task added');
  },
};

export const view = { title: () => 'Tasks', render };
