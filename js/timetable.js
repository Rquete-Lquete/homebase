// Timetable: weekly lessons. Today uses it to show what's on now and what's next.

import { state, save, uid, subjects, subjectColor } from './store.js';
import { esc, icon, fmtTime, toMin, nowMin, fmtDur, toast, openSheet, closeSheet, refresh, armed, WEEKDAYS } from './ui.js';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const short = (d) => WEEKDAYS[d].slice(0, 3);
let day = null;

export const lessonsOn = (d) => state.timetable.filter((l) => l.day === d).sort((a, b) => toMin(a.start) - toMin(b.start));

/** What's happening right now: the current lesson, the next one, and how far along we are. */
export function nowNext(date = new Date()) {
  const list = lessonsOn(date.getDay());
  const m = nowMin(date);
  const current = list.find((l) => toMin(l.start) <= m && m < toMin(l.end)) || null;
  const next = list.find((l) => toMin(l.start) > m) || null;
  return {
    list,
    current,
    next,
    done: list.filter((l) => toMin(l.end) <= m).length,
    progress: current ? (m - toMin(current.start)) / Math.max(1, toMin(current.end) - toMin(current.start)) : 0,
    left: current ? toMin(current.end) - m : 0,
    until: next ? toMin(next.start) - m : 0,
    lastEnd: list.length ? toMin(list[list.length - 1].end) : 0,
  };
}

function lessonRow(l, live) {
  const isNow = live && live.current?.id === l.id;
  const isPast = live && toMin(l.end) <= nowMin();
  return `<button class="lesson${isNow ? ' now' : ''}${isPast ? ' past' : ''}" style="--subj:${subjectColor(l.subject)}" data-action="tt-edit" data-id="${esc(l.id)}">
    <span class="ls-time"><b>${esc(fmtTime(l.start))}</b><span>${esc(fmtTime(l.end))}</span></span>
    <span class="ls-bar" aria-hidden="true"></span>
    <span class="ls-main"><span class="ls-subj">${esc(l.subject)}</span>
      <span class="ls-meta">${[l.room, fmtDur(toMin(l.end) - toMin(l.start))].filter(Boolean).map(esc).join(', ')}${isNow ? `<span class="live-pill">Now, ${fmtDur(live.left)} left</span>` : ''}</span></span>
  </button>`;
}

export function renderBody() {
  const today = new Date().getDay();
  if (day == null) day = DAYS.includes(today) && lessonsOn(today).length ? today : (today === 0 || today === 6 ? 1 : today);
  const used = new Set(state.timetable.map((l) => l.day));
  const shown = DAYS.filter((d) => d >= 1 && d <= 5 || used.has(d));
  const chips = shown.map((d) => `<button class="chip daychip${d === day ? ' on' : ''}${d === today ? ' is-today' : ''}" data-action="tt-day" data-day="${d}" aria-pressed="${d === day}">${short(d)}</button>`).join('');
  const list = lessonsOn(day);
  const live = day === today ? nowNext() : null;
  const body = list.length
    ? `<div class="lessons">${list.map((l) => lessonRow(l, live)).join('')}</div>`
    : `<div class="empty small"><p>${state.timetable.length ? `Nothing on ${WEEKDAYS[day]}.` : 'Add your lessons once and Today will show what’s on now, what’s next and how long is left.'}</p></div>`;
  return `<div class="chips" role="toolbar" aria-label="Day">${chips}</div>
    <section class="section">${body}
      <div class="toolbar flush"><button class="btn btn-primary" data-action="tt-new">${icon('plus', 16)}Add lesson</button></div>
    </section>`;
}

function sheet(lesson) {
  const isNew = !lesson;
  const last = lessonsOn(day ?? 1).slice(-1)[0];
  const l = lesson || { subject: '', day, start: last ? last.end : '08:00', end: '', room: '' };
  if (!l.end) {
    const e = toMin(l.start) + 60;
    l.end = `${String(Math.floor(e / 60) % 24).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
  }
  const dayPick = isNew
    ? `<p class="group-label">Days</p><div class="daypick">${DAYS.map((d) => `<label><input type="checkbox" name="days" value="${d}"${d === day ? ' checked' : ''}><span>${short(d)}</span></label>`).join('')}</div>`
    : `<div class="group"><label class="field"><span>Day</span><select name="day">${DAYS.map((d) => `<option value="${d}"${d === l.day ? ' selected' : ''}>${WEEKDAYS[d]}</option>`).join('')}</select></label></div>`;
  return `<form data-form="tt-save" class="sheet-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(l.id || '')}">
    <div class="sheet-head"><button type="button" class="link" data-action="sheet-close">Cancel</button>
      <h2>${isNew ? 'New lesson' : 'Edit lesson'}</h2><button type="submit" class="link strong">${isNew ? 'Add' : 'Done'}</button></div>
    <div class="group"><input class="field-input big" name="subject" required maxlength="40" list="tt-subjects" placeholder="Subject" value="${esc(l.subject)}" aria-label="Subject">
      <datalist id="tt-subjects">${subjects().map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist></div>
    <div class="quick-chips">${subjects().slice(0, 9).map((s) => `<button type="button" class="chip mini" data-action="tt-pick" data-subject="${esc(s)}"><i style="background:${subjectColor(s)}"></i>${esc(s)}</button>`).join('')}</div>
    <div class="group">
      <label class="field"><span>Starts</span><input type="time" name="start" required value="${esc(l.start)}"></label>
      <label class="field"><span>Ends</span><input type="time" name="end" required value="${esc(l.end)}"></label>
      <label class="field"><span>Room</span><input name="room" maxlength="30" placeholder="Lab 3" value="${esc(l.room)}"></label>
    </div>
    ${dayPick}
    ${isNew ? '' : `<div class="group"><button type="button" class="row-btn danger" data-action="tt-delete" data-id="${esc(l.id)}">${icon('trash', 20)}<span class="lbl">Delete lesson</span></button></div>`}
  </form>`;
}

export const actions = {
  'tt-day': (el) => { day = Number(el.dataset.day); refresh(); },
  'tt-new': () => openSheet(sheet(null), { label: 'New lesson' }),
  'tt-edit': (el) => {
    const l = state.timetable.find((x) => x.id === el.dataset.id);
    if (l) openSheet(sheet(l), { label: 'Edit lesson' });
  },
  'tt-pick': (el) => {
    const input = el.closest('form')?.elements.subject;
    if (input) input.value = el.dataset.subject;
  },
  'tt-delete': (el) => {
    if (!armed(el, 'Tap again to delete')) return;
    state.timetable = state.timetable.filter((l) => l.id !== el.dataset.id);
    save(); closeSheet(); refresh(); toast('Lesson deleted');
  },
};

export const forms = {
  'tt-save': (form, fd) => {
    const subject = String(fd.get('subject') || '').trim();
    const start = String(fd.get('start') || '');
    const end = String(fd.get('end') || '');
    if (!subject || !start || !end) return;
    if (toMin(end) <= toMin(start)) { toast('The end time has to be after the start time.'); return; }
    const room = String(fd.get('room') || '').trim();
    const id = fd.get('id');
    if (id) {
      const l = state.timetable.find((x) => x.id === id);
      if (l) Object.assign(l, { subject, start, end, room, day: Number(fd.get('day')) });
    } else {
      const days = fd.getAll('days').map(Number);
      if (!days.length) { toast('Pick at least one day.'); return; }
      for (const d of days) state.timetable.push({ id: uid(), subject, day: d, start, end, room });
    }
    save(); closeSheet(); refresh();
    toast(id ? 'Lesson updated' : 'Lesson added');
  },
};
