// IDP: the SST-NP Integrated Diploma Programme hub. Capstone milestones and a
// work log, a shortlist of NP diploma courses, key dates, and a portfolio of
// evidence (projects, awards, roles) to carry into poly.

import { state, save, uid } from './store.js';
import {
  esc, icon, pageHeader, dateKey, dayDiff, fmtDayAbs, fmtShortDate, MONTHS, toast, openSheet, closeSheet, refresh, copyText, armed, ring,
} from './ui.js';

export const CATEGORIES = ['Project', 'Competition', 'Award', 'Leadership', 'CCA', 'Certificate', 'Service', 'Work attachment', 'Other'];
const SCHOOLS = ['School of InfoComm Technology', 'School of Engineering', 'School of Life Sciences & Chemical Technology', 'School of Design & Environment', 'Other'];

let segment = sessionStorage.getItem('hb.idpSeg') || 'capstone';
const idp = () => state.idp;

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

function countdown(date) {
  const n = dayDiff(dateKey(), date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `${n} days`;
  return n === -1 ? 'Yesterday' : `${-n} days ago`;
}

/* ---------- The path strip at the top ---------- */

function pathHTML() {
  const ms = idp().capstone.milestones;
  const done = ms.filter((m) => m.done).length;
  return `<div class="path">
    <div class="path-step"><span class="path-dot on"></span><b>Sec 3</b><span>School-based assessments</span></div>
    <div class="path-step"><span class="path-dot${ms.length && done === ms.length ? ' on' : ''}"></span><b>Sec 4</b><span>Pass the capstone</span></div>
    <div class="path-step"><span class="path-dot"></span><b>NP Year 1</b><span>Your diploma course</span></div>
  </div>
  <details class="req"><summary>What you need to move on to NP</summary>
    <ul><li>School-based assessments in Sec 3 and Sec 4 (there are no O-Level papers for your other subjects).</li>
      <li>At least a pass for your capstone project in Sec 4.</li>
      <li>Mother Tongue is the one subject you still sit at O-Level.</li></ul>
    <p>From SST’s IDP FAQ (last updated January 2024). Your IDP teachers have the current rules.
      <a href="https://www.sst.edu.sg/about-sst/faqs/faq-idp/" target="_blank" rel="noopener">Open the FAQ</a></p></details>`;
}

/* ---------- Key dates ---------- */

export function upcomingDates(withinDays = 9999) {
  const today = dateKey();
  const ms = idp().capstone.milestones.filter((m) => m.date && !m.done).map((m) => ({ id: m.id, title: m.title, date: m.date, kind: 'Capstone' }));
  const own = idp().dates.map((d) => ({ ...d, kind: '' }));
  return [...own, ...ms].filter((d) => { const n = dayDiff(today, d.date); return n >= 0 && n <= withinDays; }).sort((a, b) => a.date.localeCompare(b.date));
}

function datesHTML() {
  const today = dateKey();
  const list = idp().dates.slice().sort((a, b) => a.date.localeCompare(b.date));
  const chips = list.map((d) => {
    const n = dayDiff(today, d.date);
    return `<button class="datechip${n < 0 ? ' past' : n <= 14 ? ' soon' : ''}" data-action="idp-date-edit" data-id="${esc(d.id)}">
      <b>${esc(countdown(d.date))}</b><span>${esc(d.title)}</span><small>${esc(fmtDayAbs(d.date))}</small></button>`;
  }).join('');
  return `<section class="section"><div class="section-head"><h2>Key dates</h2><button class="link" data-action="idp-date-new">Add</button></div>
    ${list.length ? `<div class="datechips">${chips}</div>` : '<div class="empty small"><p>Add dates as they’re announced: capstone showcase, RED Camp, your Mother Tongue O-Level papers, NP course selection. They count down here and on Today.</p></div>'}
  </section>`;
}

/* ---------- Capstone ---------- */

function capstoneHTML() {
  const c = idp().capstone;
  const ms = c.milestones.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const done = ms.filter((m) => m.done).length;
  const pct = ms.length ? done / ms.length : 0;
  const today = dateKey();
  const msRows = ms.map((m) => {
    const n = m.date ? dayDiff(today, m.date) : null;
    return `<div class="row task${m.done ? ' is-done' : ''}">
      <button class="check" data-action="idp-ms-toggle" data-id="${esc(m.id)}" aria-pressed="${m.done}" aria-label="${m.done ? 'Mark as not done' : 'Mark as done'}: ${esc(m.title)}">${icon('check', 16)}</button>
      <button class="row-main" data-action="idp-ms-edit" data-id="${esc(m.id)}"><span class="t-title">${esc(m.title)}</span>
        ${m.date ? `<span class="t-meta"><span class="due${!m.done && n < 0 ? ' overdue' : !m.done && n <= 7 ? ' soon' : ''}">${esc(fmtDayAbs(m.date))}${m.done ? '' : `, ${esc(countdown(m.date).toLowerCase())}`}</span></span>` : ''}</button></div>`;
  }).join('');
  const logRows = c.log.slice().sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).map((l) =>
    `<button class="logrow" data-action="idp-log-edit" data-id="${esc(l.id)}"><span class="log-date">${esc(fmtShortDate(l.date))}</span>
      <span class="log-body"><span>${esc(l.did)}</span>${l.next ? `<small>Next: ${esc(l.next)}</small>` : ''}</span></button>`).join('');
  return `<section class="section"><div class="cap-card">
      <div class="cap-top">${ring(pct, { size: 72, stroke: 8, color: 'var(--folio)', label: `${done} of ${ms.length} milestones done` })}
        <div class="cap-text"><textarea class="cap-title grow one-line" rows="1" maxlength="100" placeholder="Capstone project name" data-input="idp-cap" data-field="title" aria-label="Capstone project name">${esc(c.title)}</textarea>
          <p>${ms.length ? `${done} of ${ms.length} milestones done` : 'No milestones yet'}</p></div></div>
      <div class="cap-fields">
        <label><span>Partner</span><input maxlength="60" placeholder="Company or organisation" value="${esc(c.partner)}" data-input="idp-cap" data-field="partner"></label>
        <label><span>Mentor</span><input maxlength="60" placeholder="Name" value="${esc(c.mentor)}" data-input="idp-cap" data-field="mentor"></label>
        <label><span>My role</span><input maxlength="60" placeholder="What you own" value="${esc(c.role)}" data-input="idp-cap" data-field="role"></label>
      </div></div></section>
    <section class="section"><div class="section-head"><h2>Milestones</h2><button class="link" data-action="idp-ms-new">Add</button></div>
      ${ms.length ? `<div class="group">${msRows}</div>` : '<div class="empty small"><p>Break the capstone into checkpoints: proposal, data collected, first model, report draft, showcase. Dated ones count down on Today.</p></div>'}</section>
    <section class="section"><div class="section-head"><h2>Work log</h2><button class="link" data-action="idp-log-new">Add entry</button></div>
      ${c.log.length ? `<div class="group loglist">${logRows}</div>
        <div class="toolbar flush"><button class="btn" data-action="idp-log-copy">${icon('copy', 16)}Copy log</button></div>`
        : '<div class="empty small"><p>Two lines after each session: what you did and what’s next. When the report and reflection are due, the record is already written.</p></div>'}</section>`;
}

/* ---------- Courses ---------- */

function coursesHTML() {
  const list = idp().courses.slice().sort((a, b) => (b.interest || 0) - (a.interest || 0) || a.name.localeCompare(b.name));
  const cards = list.map((c, i) => `<div class="course">
      <button class="course-main" data-action="idp-course-edit" data-id="${esc(c.id)}"><span class="course-rank">${i + 1}</span>
        <span class="course-text"><b>${esc(c.name)}</b><small>${esc(c.school || '')}</small>${c.notes ? `<span class="course-notes">${esc(c.notes)}</span>` : ''}</span></button>
      <div class="dots" role="group" aria-label="Interest in ${esc(c.name)}">${[1, 2, 3, 4, 5].map((n) =>
        `<button class="dot${n <= (c.interest || 0) ? ' on' : ''}" data-action="idp-course-rate" data-id="${esc(c.id)}" data-n="${n}" aria-label="${n} of 5" aria-pressed="${n <= (c.interest || 0)}"></button>`).join('')}</div>
    </div>`).join('');
  return `<p class="intro">IDP students move on to one of 21 STEM diploma courses across four NP schools. Shortlist the ones you’re weighing, rate how keen you are, and note what you still want to find out.</p>
    <div class="toolbar"><button class="btn btn-primary" data-action="idp-course-new">${icon('plus', 16)}Add a course</button>
      <a class="btn" href="https://www.np.edu.sg/schools-courses/academic-schools" target="_blank" rel="noopener">${icon('link', 16)}NP course list</a></div>
    ${list.length ? `<section class="section"><div class="courses">${cards}</div></section>` : '<div class="empty small inset-block"><p>Nothing shortlisted yet. Ranked by how keen you are, the list makes the choice easier when course selection comes.</p></div>'}`;
}

/* ---------- Portfolio (evidence) ---------- */

function entryRow(e) {
  const meta = [e.role, fmtMonth(e.month)].filter(Boolean).join(', ');
  return `<div class="row"><button class="row-main" data-action="folio-edit" data-id="${esc(e.id)}">
      <span class="t-title">${esc(e.title)}</span>${meta ? `<span class="t-meta">${esc(meta)}</span>` : ''}</button>
    <button class="star${e.star ? ' on' : ''}" data-action="folio-star" data-id="${esc(e.id)}" aria-pressed="${Boolean(e.star)}"
      aria-label="${e.star ? 'Remove highlight from' : 'Highlight'} ${esc(e.title)}">${icon(e.star ? 'starFill' : 'star', 22)}</button></div>`;
}

function portfolioHTML() {
  const entries = state.portfolio.entries;
  const tools = `<div class="toolbar"><button class="btn btn-primary" data-action="folio-new">${icon('plus', 16)}Add evidence</button>
    ${entries.length ? `<button class="btn" data-action="folio-export">${icon('copy', 16)}Copy all</button>` : ''}</div>`;
  if (!entries.length) {
    return `${tools}<div class="empty small inset-block"><p>Log things as they happen: projects, competitions, leadership roles, certificates, service. It becomes the record you draw on for scholarship forms, NP interviews and your résumé.</p></div>`;
  }
  const byDate = (a, b) => (b.month || '').localeCompare(a.month || '') || b.createdAt - a.createdAt;
  const stars = entries.filter((e) => e.star).sort(byDate);
  let out = tools;
  if (stars.length) out += `<section class="section"><div class="section-head"><h2>Highlights</h2><span class="count">${stars.length}</span></div><div class="group">${stars.map(entryRow).join('')}</div></section>`;
  for (const cat of CATEGORIES) {
    const list = entries.filter((e) => e.category === cat && !e.star).sort(byDate);
    if (list.length) out += `<section class="section"><div class="section-head"><h2>${esc(cat)}</h2><span class="count">${list.length}</span></div><div class="group">${list.map(entryRow).join('')}</div></section>`;
  }
  return out;
}

function render() {
  const segs = [['capstone', 'Capstone'], ['courses', 'Courses'], ['portfolio', 'Portfolio']];
  const body = segment === 'courses' ? coursesHTML() : segment === 'portfolio' ? portfolioHTML() : datesHTML() + capstoneHTML();
  return `${pageHeader('IDP', { sub: 'SST to Ngee Ann Poly, through-train' })}
    ${pathHTML()}
    <div class="segmented buttons page-seg" role="group" aria-label="IDP sections">${segs.map(([id, label]) =>
      `<button class="${segment === id ? 'on' : ''}" data-action="idp-seg" data-seg="${id}" aria-pressed="${segment === id}">${label}</button>`).join('')}</div>
    ${body}`;
}

/* ---------- Sheets ---------- */

const head = (title, isNew) => `<div class="sheet-head"><button type="button" class="link" data-action="sheet-close">Cancel</button>
  <h2>${title}</h2><button type="submit" class="link strong">${isNew ? 'Add' : 'Done'}</button></div>`;
const del = (action, id, label) => `<div class="group"><button type="button" class="row-btn danger" data-action="${action}" data-id="${esc(id)}">${icon('trash', 20)}<span class="lbl">${label}</span></button></div>`;

function dateSheet(d) {
  const x = d || { title: '', date: '' };
  return `<form data-form="idp-date-save" class="sheet-form" autocomplete="off"><input type="hidden" name="id" value="${esc(x.id || '')}">
    ${head(d ? 'Edit date' : 'New date', !d)}
    <div class="group"><input class="field-input big" name="title" required maxlength="60" placeholder="What’s happening?" value="${esc(x.title)}" aria-label="Title"></div>
    <div class="group"><label class="field"><span>Date</span><input type="date" name="date" required value="${esc(x.date)}"></label></div>
    ${d ? del('idp-date-delete', x.id, 'Delete date') : ''}</form>`;
}

function msSheet(m) {
  const x = m || { title: '', date: '' };
  return `<form data-form="idp-ms-save" class="sheet-form" autocomplete="off"><input type="hidden" name="id" value="${esc(x.id || '')}">
    ${head(m ? 'Edit milestone' : 'New milestone', !m)}
    <div class="group"><input class="field-input big" name="title" required maxlength="80" placeholder="Milestone" value="${esc(x.title)}" aria-label="Milestone"></div>
    <div class="group"><label class="field${x.date ? '' : ' is-empty'}"><span>Due</span><input class="opt" type="date" name="date" value="${esc(x.date)}"></label></div>
    ${m ? del('idp-ms-delete', x.id, 'Delete milestone') : ''}</form>`;
}

function logSheet(l) {
  const x = l || { date: dateKey(), did: '', next: '' };
  return `<form data-form="idp-log-save" class="sheet-form" autocomplete="off"><input type="hidden" name="id" value="${esc(x.id || '')}">
    ${head(l ? 'Edit entry' : 'Log entry', !l)}
    <div class="group"><label class="field"><span>Date</span><input type="date" name="date" required value="${esc(x.date)}"></label></div>
    <div class="group"><textarea class="field-input" name="did" required rows="4" maxlength="1500" placeholder="What I did" aria-label="What I did">${esc(x.did)}</textarea></div>
    <div class="group"><textarea class="field-input" name="next" rows="2" maxlength="600" placeholder="What’s next" aria-label="What’s next">${esc(x.next)}</textarea></div>
    ${l ? del('idp-log-delete', x.id, 'Delete entry') : ''}</form>`;
}

function courseSheet(c) {
  const x = c || { name: '', school: SCHOOLS[0], notes: '', interest: 3 };
  return `<form data-form="idp-course-save" class="sheet-form" autocomplete="off"><input type="hidden" name="id" value="${esc(x.id || '')}">
    ${head(c ? 'Edit course' : 'New course', !c)}
    <div class="group"><input class="field-input big" name="name" required maxlength="80" placeholder="Diploma in…" value="${esc(x.name)}" aria-label="Course name"></div>
    <div class="group"><label class="field"><span>School</span><select name="school">${SCHOOLS.map((s) => `<option${s === x.school ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
    <div class="group"><textarea class="field-input" name="notes" rows="4" maxlength="1000" placeholder="Why it fits, and what you still want to find out" aria-label="Notes">${esc(x.notes)}</textarea></div>
    ${c ? del('idp-course-delete', x.id, 'Remove course') : ''}</form>`;
}

function entrySheet(e) {
  const x = e || { title: '', category: 'Project', month: '', role: '', what: '', result: '', skills: '', link: '' };
  return `<form data-form="folio-save" class="sheet-form" autocomplete="off"><input type="hidden" name="id" value="${esc(x.id || '')}">
    ${head(e ? 'Edit evidence' : 'New evidence', !e)}
    <div class="group"><input class="field-input big" name="title" required maxlength="120" placeholder="What was it?" value="${esc(x.title)}" aria-label="Title"></div>
    <div class="group">
      <label class="field"><span>Type</span><select name="category">${CATEGORIES.map((c) => `<option${c === x.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field${x.month ? '' : ' is-empty'}"><span>When</span><input class="opt" type="month" name="month" value="${esc(x.month)}"></label>
      <label class="field"><span>Your role</span><input name="role" maxlength="60" placeholder="Team lead" value="${esc(x.role)}"></label></div>
    <div class="group"><textarea class="field-input" name="what" rows="3" maxlength="1500" placeholder="What you did" aria-label="What you did">${esc(x.what)}</textarea></div>
    <div class="group"><textarea class="field-input" name="result" rows="2" maxlength="800" placeholder="What came of it: a result, prize or feedback" aria-label="Result">${esc(x.result)}</textarea></div>
    <div class="group">
      <label class="field"><span>Skills</span><input name="skills" maxlength="120" placeholder="Python, teamwork" value="${esc(x.skills)}"></label>
      <label class="field"><span>Link</span><input type="url" name="link" inputmode="url" maxlength="300" placeholder="https://" value="${esc(x.link)}" autocapitalize="off"></label></div>
    ${e ? del('folio-delete', x.id, 'Delete') : ''}</form>`;
}

function exportEvidence() {
  const lines = [`Portfolio evidence, exported ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`, ''];
  for (const cat of CATEGORIES) {
    const list = state.portfolio.entries.filter((e) => e.category === cat).sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    if (!list.length) continue;
    lines.push(cat);
    for (const e of list) {
      lines.push(`• ${e.title}${e.role ? ` (${e.role})` : ''}${fmtMonth(e.month) ? `, ${fmtMonth(e.month)}` : ''}${e.star ? ' ★' : ''}`);
      if (e.what) lines.push(`  What I did: ${e.what}`);
      if (e.result) lines.push(`  Result: ${e.result}`);
      if (e.skills) lines.push(`  Skills: ${e.skills}`);
      if (e.link) lines.push(`  Link: ${e.link}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/* ---------- Event handlers ---------- */

const find = (list, id) => list.find((x) => x.id === id);
function upsert(list, id, data) {
  if (id) Object.assign(find(list, id) || {}, data);
  else list.push({ id: uid(), ...data });
}
function remove(key, el, list, setter, msg) {
  if (!armed(el, 'Tap again to delete')) return;
  setter(list.filter((x) => x.id !== el.dataset.id));
  save(); closeSheet(); refresh(); toast(msg);
}

export const actions = {
  'idp-seg': (el) => { segment = el.dataset.seg; sessionStorage.setItem('hb.idpSeg', segment); refresh(); },

  'idp-date-new': () => openSheet(dateSheet(null), { label: 'New date' }),
  'idp-date-edit': (el) => { const d = find(idp().dates, el.dataset.id); if (d) openSheet(dateSheet(d), { label: 'Edit date' }); },
  'idp-date-delete': (el) => remove('dates', el, idp().dates, (v) => { idp().dates = v; }, 'Date deleted'),

  'idp-ms-new': () => openSheet(msSheet(null), { label: 'New milestone' }),
  'idp-ms-edit': (el) => { const m = find(idp().capstone.milestones, el.dataset.id); if (m) openSheet(msSheet(m), { label: 'Edit milestone' }); },
  'idp-ms-toggle': (el) => {
    const m = find(idp().capstone.milestones, el.dataset.id);
    if (!m) return;
    m.done = !m.done; save(); refresh();
  },
  'idp-ms-delete': (el) => remove('ms', el, idp().capstone.milestones, (v) => { idp().capstone.milestones = v; }, 'Milestone deleted'),

  'idp-log-new': () => openSheet(logSheet(null), { label: 'Log entry' }),
  'idp-log-edit': (el) => { const l = find(idp().capstone.log, el.dataset.id); if (l) openSheet(logSheet(l), { label: 'Edit entry' }); },
  'idp-log-delete': (el) => remove('log', el, idp().capstone.log, (v) => { idp().capstone.log = v; }, 'Entry deleted'),
  'idp-log-copy': async () => {
    const c = idp().capstone;
    const text = [`${c.title || 'Capstone'} work log`, '', ...c.log.slice().sort((a, b) => a.date.localeCompare(b.date)).map((l) => `${fmtDayAbs(l.date)} ${l.date.slice(0, 4)}\n${l.did}${l.next ? `\nNext: ${l.next}` : ''}\n`)].join('\n');
    toast((await copyText(text)) ? 'Copied the work log' : 'Couldn’t copy. Try again.');
  },

  'idp-course-new': () => openSheet(courseSheet(null), { label: 'New course' }),
  'idp-course-edit': (el) => { const c = find(idp().courses, el.dataset.id); if (c) openSheet(courseSheet(c), { label: 'Edit course' }); },
  'idp-course-rate': (el) => {
    const c = find(idp().courses, el.dataset.id);
    if (!c) return;
    const n = Number(el.dataset.n);
    c.interest = c.interest === n ? n - 1 : n;
    save(); refresh();
  },
  'idp-course-delete': (el) => remove('courses', el, idp().courses, (v) => { idp().courses = v; }, 'Course removed'),

  'folio-new': () => openSheet(entrySheet(null), { label: 'New evidence' }),
  'folio-edit': (el) => { const e = find(state.portfolio.entries, el.dataset.id); if (e) openSheet(entrySheet(e), { label: 'Edit evidence' }); },
  'folio-star': (el) => { const e = find(state.portfolio.entries, el.dataset.id); if (e) { e.star = !e.star; save(); refresh(); } },
  'folio-delete': (el) => remove('folio', el, state.portfolio.entries, (v) => { state.portfolio.entries = v; }, 'Deleted'),
  'folio-export': async () => { toast((await copyText(exportEvidence())) ? 'Copied your evidence as text' : 'Couldn’t copy. Try again.'); },
};

export const inputs = {
  'idp-cap': (el) => {
    if (el.value.includes('\n')) el.value = el.value.replace(/\s*\n\s*/g, ' ');
    idp().capstone[el.dataset.field] = el.value;
    save();
  },
};

const str = (fd, k) => String(fd.get(k) || '').trim();
const done = (msg) => { save(); closeSheet(); refresh(); toast(msg); };

export const forms = {
  'idp-date-save': (form, fd) => {
    if (!str(fd, 'title') || !str(fd, 'date')) return;
    upsert(idp().dates, fd.get('id'), { title: str(fd, 'title'), date: str(fd, 'date') });
    done('Date saved');
  },
  'idp-ms-save': (form, fd) => {
    if (!str(fd, 'title')) return;
    const id = fd.get('id');
    upsert(idp().capstone.milestones, id, id ? { title: str(fd, 'title'), date: str(fd, 'date') } : { title: str(fd, 'title'), date: str(fd, 'date'), done: false });
    done('Milestone saved');
  },
  'idp-log-save': (form, fd) => {
    if (!str(fd, 'did')) return;
    const id = fd.get('id');
    upsert(idp().capstone.log, id, { date: str(fd, 'date') || dateKey(), did: str(fd, 'did'), next: str(fd, 'next'), ...(id ? {} : { at: Date.now() }) });
    done('Entry saved');
  },
  'idp-course-save': (form, fd) => {
    if (!str(fd, 'name')) return;
    const id = fd.get('id');
    upsert(idp().courses, id, { name: str(fd, 'name'), school: str(fd, 'school'), notes: str(fd, 'notes'), ...(id ? {} : { interest: 3 }) });
    done('Course saved');
  },
  'folio-save': (form, fd) => {
    if (!str(fd, 'title')) return;
    const data = {
      title: str(fd, 'title'), category: CATEGORIES.includes(fd.get('category')) ? fd.get('category') : 'Other',
      month: str(fd, 'month'), role: str(fd, 'role'), what: str(fd, 'what'), result: str(fd, 'result'), skills: str(fd, 'skills'), link: str(fd, 'link'),
    };
    const id = fd.get('id');
    upsert(state.portfolio.entries, id, id ? data : { ...data, star: false, createdAt: Date.now() });
    done(id ? 'Saved' : 'Added');
  },
};

export const view = { title: () => 'IDP', render };
