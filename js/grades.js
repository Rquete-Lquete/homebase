// Grades: scores for each subject. On the IDP track school-based assessments
// count, so this keeps a running percentage per subject.

import { state, save, uid, subjects, subjectColor } from './store.js';
import { esc, icon, fmtNum, fmtShortDate, dateKey, toast, openSheet, closeSheet, refresh, armed } from './ui.js';

let open = null;

/** Weighted by each assessment's weight when every one has a weight; a plain average otherwise. */
export function subjectPct(list) {
  const valid = list.filter((g) => g.max > 0);
  if (!valid.length) return null;
  if (valid.every((g) => g.weight > 0)) {
    const w = valid.reduce((s, g) => s + g.weight, 0);
    return valid.reduce((s, g) => s + (g.score / g.max) * g.weight, 0) / w * 100;
  }
  return valid.reduce((s, g) => s + g.score / g.max, 0) / valid.length * 100;
}

export function summary() {
  const by = new Map();
  for (const g of state.grades) {
    const k = g.subject.trim();
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(g);
  }
  const rows = [...by.entries()].map(([subject, list]) => ({ subject, list, pct: subjectPct(list) })).sort((a, b) => a.subject.localeCompare(b.subject));
  const pcts = rows.map((r) => r.pct).filter((p) => p != null);
  return { rows, overall: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null };
}

export function renderBody() {
  const { rows, overall } = summary();
  const tools = `<div class="toolbar"><button class="btn btn-primary" data-action="gr-new">${icon('plus', 16)}Add a score</button></div>`;
  if (!rows.length) {
    return `${tools}<div class="empty small inset-block"><p>Record each test and assignment score. Homebase works out your running percentage for every subject, weighted if you enter weights.</p></div>`;
  }
  const cards = rows.map((r) => {
    const isOpen = open === r.subject;
    const items = isOpen ? `<div class="gr-items">${r.list.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((g) =>
      `<button class="gr-item" data-action="gr-edit" data-id="${esc(g.id)}"><span>${esc(g.name)}<small>${[g.date ? fmtShortDate(g.date) : '', g.weight ? `${fmtNum(g.weight, 1)}% of grade` : ''].filter(Boolean).join(', ')}</small></span>
        <b>${fmtNum(g.score, 1)}<span class="u">/ ${fmtNum(g.max, 1)}</span></b></button>`).join('')}</div>` : '';
    return `<div class="gr-card" style="--subj:${subjectColor(r.subject)}">
      <button class="gr-head" data-action="gr-toggle" data-subject="${esc(r.subject)}" aria-expanded="${isOpen}">
        <span class="gr-name">${esc(r.subject)}<small>${r.list.length} score${r.list.length === 1 ? '' : 's'}</small></span>
        <span class="gr-pct"><span data-count="${Math.round(r.pct)}">0</span><span class="u">%</span></span>
        <span class="gr-bar"><i class="grow-bar" style="--w:${Math.min(100, r.pct)}%"></i></span>
      </button>${items}</div>`;
  }).join('');
  return `<div class="gr-overall"><span>Average across ${rows.length} subject${rows.length === 1 ? '' : 's'}</span><b><span data-count="${Math.round(overall)}">0</span>%</b></div>
    ${tools}<div class="gr-list">${cards}</div>
    <p class="credit">This is your own running record. Your school’s official grades may be weighted differently.</p>`;
}

function sheet(g) {
  const isNew = !g;
  const x = g || { subject: open || '', name: '', score: '', max: '', weight: '', date: dateKey() };
  return `<form data-form="gr-save" class="sheet-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(x.id || '')}">
    <div class="sheet-head"><button type="button" class="link" data-action="sheet-close">Cancel</button>
      <h2>${isNew ? 'New score' : 'Edit score'}</h2><button type="submit" class="link strong">${isNew ? 'Add' : 'Done'}</button></div>
    <div class="group"><input class="field-input big" name="name" required maxlength="60" placeholder="Which assessment?" value="${esc(x.name)}" aria-label="Assessment"></div>
    <div class="group">
      <label class="field"><span>Subject</span><input name="subject" required list="gr-subjects" maxlength="40" placeholder="Chemistry" value="${esc(x.subject)}"></label>
      <datalist id="gr-subjects">${subjects().map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>
      <label class="field"><span>Score</span><input name="score" required type="number" inputmode="decimal" step="any" min="0" placeholder="32" value="${esc(x.score)}"></label>
      <label class="field"><span>Out of</span><input name="max" required type="number" inputmode="decimal" step="any" min="0.1" placeholder="40" value="${esc(x.max)}"></label>
      <label class="field"><span>Weight (%)</span><input name="weight" type="number" inputmode="decimal" step="any" min="0" max="100" placeholder="Optional" value="${esc(x.weight || '')}"></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${esc(x.date || '')}"></label>
    </div>
    <p class="hint">Weight is how much this counts toward the subject’s final grade. Leave it empty if you don’t know.</p>
    ${isNew ? '' : `<div class="group"><button type="button" class="row-btn danger" data-action="gr-delete" data-id="${esc(x.id)}">${icon('trash', 20)}<span class="lbl">Delete score</span></button></div>`}
  </form>`;
}

export const actions = {
  'gr-new': () => openSheet(sheet(null), { label: 'New score' }),
  'gr-edit': (el) => {
    const g = state.grades.find((x) => x.id === el.dataset.id);
    if (g) openSheet(sheet(g), { label: 'Edit score' });
  },
  'gr-toggle': (el) => { open = open === el.dataset.subject ? null : el.dataset.subject; refresh(); },
  'gr-delete': (el) => {
    if (!armed(el, 'Tap again to delete')) return;
    state.grades = state.grades.filter((g) => g.id !== el.dataset.id);
    save(); closeSheet(); refresh(); toast('Score deleted');
  },
};

export const forms = {
  'gr-save': (form, fd) => {
    const num = (k) => Number.parseFloat(fd.get(k));
    const data = {
      name: String(fd.get('name') || '').trim(),
      subject: String(fd.get('subject') || '').trim(),
      score: num('score'), max: num('max'), weight: num('weight') || 0,
      date: String(fd.get('date') || ''),
    };
    if (!data.name || !data.subject || !(data.max > 0) || !(data.score >= 0)) { toast('Fill in the assessment, subject, score and total.'); return; }
    if (data.score > data.max) { toast('The score is higher than the total. Check the numbers.'); return; }
    const id = fd.get('id');
    if (id) Object.assign(state.grades.find((g) => g.id === id) || {}, data);
    else state.grades.push({ id: uid(), ...data });
    open = data.subject;
    save(); closeSheet(); refresh();
    toast(id ? 'Score updated' : 'Score added');
  },
};
