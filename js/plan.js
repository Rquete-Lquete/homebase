// Plan: tasks, the weekly timetable and grades, under one tab.

import { icon, pageHeader, refresh } from './ui.js';
import * as tasks from './tasks.js';
import * as timetable from './timetable.js';
import * as grades from './grades.js';
import { weekHTML } from './focus.js';

let segment = sessionStorage.getItem('hb.planSeg') || 'tasks';

export function setSegment(s) {
  segment = s;
  sessionStorage.setItem('hb.planSeg', s);
}

function render() {
  const segs = [['tasks', 'Tasks'], ['timetable', 'Timetable'], ['grades', 'Grades']];
  const body = segment === 'timetable' ? timetable.renderBody() : segment === 'grades' ? grades.renderBody() : tasks.renderBody() + weekHTML();
  const right = segment === 'tasks'
    ? `<button class="icon-btn" data-action="focus-new" aria-label="Start focus">${icon('timer', 21)}</button><button class="icon-btn solid" data-action="task-new" aria-label="New task">${icon('plus', 22)}</button>` : '';
  return `${pageHeader('Plan', { right })}
    <div class="segmented buttons page-seg" role="group" aria-label="Plan sections">${segs.map(([id, label]) =>
      `<button class="${segment === id ? 'on' : ''}" data-action="plan-seg" data-seg="${id}" aria-pressed="${segment === id}">${label}</button>`).join('')}</div>
    ${body}`;
}

export const actions = {
  'plan-seg': (el) => { setSegment(el.dataset.seg); refresh(); },
};

export const view = { title: () => 'Plan', render };
