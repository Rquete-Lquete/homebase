// Portfolio: everything for a polytechnic Early Admissions Exercise (EAE)
// application to Ngee Ann Poly. Course write-ups with the portal's character
// limits, a log of evidence (projects, awards, roles) and interview notes.

import { state, save, uid } from './store.js';
import {
  esc, icon, pageHeader, dateKey, dayDiff, MONTHS, toast, openSheet, closeSheet, refresh, copyText, armed,
} from './ui.js';

const COURSE_LIMIT = 600;
const TALENTS_LIMIT = 1000;

export const CATEGORIES = ['Project', 'Competition', 'Award', 'Leadership', 'CCA', 'Certificate', 'Service', 'Work attachment', 'Other'];

const PROMPTS = [
  { id: 'why', q: 'Why this course, and why Ngee Ann?' },
  { id: 'proud', q: 'Tell us about a project you’re proud of. What was your part in it?' },
  { id: 'setback', q: 'Describe a setback and what you did about it.' },
  { id: 'outside', q: 'What do you do outside class that connects to this course?' },
  { id: 'next', q: 'Where do you want to be after the diploma?' },
];

let segment = sessionStorage.getItem('hb.folioSeg') || 'writeups';

const count = (s) => [...String(s || '')].length;

function counterHTML(text, limit, which, i = '') {
  const n = count(text);
  return `<div class="counter"><span class="count-num${n > limit ? ' over' : ''}" data-limit="${limit}">${n}</span>&nbsp;/ ${limit}
    <button type="button" class="link small" data-action="folio-copy" data-which="${which}" data-i="${i}">Copy</button></div>`;
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/* ---------- Segments ---------- */

function writeupsHTML() {
  const p = state.portfolio;
  let countdown = '';
  if (p.eaeDate) {
    const n = dayDiff(dateKey(), p.eaeDate);
    countdown = n > 0 ? `Applications open in ${n} day${n === 1 ? '' : 's'}.` : n === 0 ? 'Applications open today.' : 'The application window has opened. Check the closing date on the EAE portal.';
  }
  const courses = p.courses.map((c, i) => `<section class="section">
      <div class="section-head"><h2>Course ${i + 1}</h2></div>
      <div class="group">
        <textarea class="field-input strong grow one-line" rows="1" maxlength="80" placeholder="Course name" data-input="folio-course" data-i="${i}" aria-label="Course ${i + 1} name">${esc(c.course)}</textarea>
        <label class="field"><span>Polytechnic</span><input maxlength="60" value="${esc(c.school)}" data-input="folio-school" data-i="${i}"></label>
        <div class="writeup"><textarea class="field-input grow" rows="7" placeholder="What draws you to this course, and what have you done that shows it?" data-input="folio-text" data-i="${i}" aria-label="Course ${i + 1} write-up">${esc(c.text)}</textarea>
          ${counterHTML(c.text, COURSE_LIMIT, 'course', i)}</div>
      </div></section>`).join('');
  return `<p class="intro">EAE asks for a write-up of up to 600 characters for each course you choose, and you can choose up to three. An optional 1,000-character write-up covers your talents and achievements. Spaces and punctuation count as characters.</p>
    <div class="group inset">
      <label class="field${p.eaeDate ? '' : ' is-empty'}"><span>Applications open</span><input class="opt" type="date" value="${esc(p.eaeDate)}" data-change="folio-eae"></label>
    </div>
    <p class="hint">${countdown ? esc(countdown) : 'The window is usually in late June of the year you take your O-Level or SEC exams. Add the date once it’s announced.'}</p>
    ${courses}
    <section class="section">
      <div class="section-head"><h2>Talents and achievements</h2></div>
      <div class="group"><div class="writeup"><textarea class="field-input grow" rows="9" placeholder="Leadership roles, competitions, projects, skills you taught yourself…" data-input="folio-talents" aria-label="Talents and achievements write-up">${esc(p.talents)}</textarea>
        ${counterHTML(p.talents, TALENTS_LIMIT, 'talents')}</div></div>
    </section>`;
}

function entryRow(e) {
  const meta = [e.role, fmtMonth(e.month)].filter(Boolean).join(', ');
  return `<div class="row">
    <button class="row-main" data-action="folio-edit" data-id="${esc(e.id)}">
      <span class="t-title">${esc(e.title)}</span>${meta ? `<span class="t-meta">${esc(meta)}</span>` : ''}</button>
    <button class="star${e.star ? ' on' : ''}" data-action="folio-star" data-id="${esc(e.id)}" aria-pressed="${Boolean(e.star)}"
      aria-label="${e.star ? 'Remove highlight from' : 'Highlight'} ${esc(e.title)}">${icon(e.star ? 'starFill' : 'star', 22)}</button>
  </div>`;
}

function evidenceHTML() {
  const entries = state.portfolio.entries;
  const tools = `<div class="toolbar"><button class="btn btn-primary" data-action="folio-new">${icon('plus', 16)}Add evidence</button>
    ${entries.length ? `<button class="btn" data-action="folio-export">${icon('copy', 16)}Copy all</button>` : ''}</div>`;
  if (!entries.length) {
    return `${tools}<div class="empty small"><p>Log things as they happen: projects, competitions, leadership roles, certificates, service. When EAE opens, your write-ups and interview answers can point to real examples with dates.</p></div>`;
  }
  const sortByDate = (a, b) => (b.month || '').localeCompare(a.month || '') || b.createdAt - a.createdAt;
  const stars = entries.filter((e) => e.star).sort(sortByDate);
  let out = tools;
  if (stars.length) {
    out += `<section class="section"><div class="section-head"><h2>Highlights</h2><span class="count">${stars.length}</span></div>
      <div class="group">${stars.map(entryRow).join('')}</div></section>`;
  }
  for (const cat of CATEGORIES) {
    const list = entries.filter((e) => e.category === cat).sort(sortByDate);
    if (!list.length) continue;
    out += `<section class="section"><div class="section-head"><h2>${esc(cat)}</h2><span class="count">${list.length}</span></div>
      <div class="group">${list.map(entryRow).join('')}</div></section>`;
  }
  return out;
}

function interviewHTML() {
  const notes = state.portfolio.interview;
  return `<p class="intro">Shortlisted applicants are interviewed. Jot down what you’d say, with one real example for each.</p>
    ${PROMPTS.map((p) => `<section class="section"><div class="section-head"><h2 class="h-question">${esc(p.q)}</h2></div>
      <div class="group"><textarea class="field-input grow" rows="4" placeholder="Your notes" data-input="folio-interview" data-id="${p.id}" aria-label="${esc(p.q)}">${esc(notes[p.id] || '')}</textarea></div></section>`).join('')}`;
}

function render() {
  const segs = [['writeups', 'Write-ups'], ['evidence', 'Evidence'], ['interview', 'Interview']];
  const body = segment === 'evidence' ? evidenceHTML() : segment === 'interview' ? interviewHTML() : writeupsHTML();
  return `${pageHeader('Portfolio', { sub: 'For your Ngee Ann Poly EAE application' })}
    <div class="segmented buttons page-seg" role="group" aria-label="Portfolio sections">${segs.map(([id, label]) =>
      `<button class="${segment === id ? 'on' : ''}" data-action="folio-seg" data-seg="${id}" aria-pressed="${segment === id}">${label}</button>`).join('')}</div>
    ${body}`;
}

/* ---------- Evidence sheet ---------- */

function entrySheet(e) {
  const isNew = !e;
  const x = e || { title: '', category: 'Project', month: '', role: '', what: '', result: '', skills: '', link: '' };
  return `<form data-form="folio-save" class="sheet-form" autocomplete="off">
    <input type="hidden" name="id" value="${esc(x.id || '')}">
    <div class="sheet-head"><button type="button" class="link" data-action="sheet-close">Cancel</button>
      <h2>${isNew ? 'New evidence' : 'Edit evidence'}</h2><button type="submit" class="link strong">${isNew ? 'Add' : 'Done'}</button></div>
    <div class="group"><input class="field-input big" name="title" required maxlength="120" placeholder="What was it?" value="${esc(x.title)}" aria-label="Title"></div>
    <div class="group">
      <label class="field"><span>Type</span><select name="category">${CATEGORIES.map((c) => `<option${c === x.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field${x.month ? '' : ' is-empty'}"><span>When</span><input class="opt" type="month" name="month" value="${esc(x.month)}"></label>
      <label class="field"><span>Your role</span><input name="role" maxlength="60" placeholder="Team lead" value="${esc(x.role)}"></label>
    </div>
    <div class="group">
      <textarea class="field-input" name="what" rows="3" maxlength="1500" placeholder="What you did" aria-label="What you did">${esc(x.what)}</textarea>
    </div>
    <div class="group">
      <textarea class="field-input" name="result" rows="2" maxlength="800" placeholder="What came of it: a result, prize or feedback" aria-label="Result">${esc(x.result)}</textarea>
    </div>
    <div class="group">
      <label class="field"><span>Skills</span><input name="skills" maxlength="120" placeholder="Python, teamwork" value="${esc(x.skills)}"></label>
      <label class="field"><span>Link</span><input type="url" name="link" inputmode="url" maxlength="300" placeholder="https://" value="${esc(x.link)}" autocapitalize="off"></label>
    </div>
    ${isNew ? '' : `<div class="group"><button type="button" class="row-btn danger" data-action="folio-delete" data-id="${esc(x.id)}">${icon('trash', 20)}<span class="lbl">Delete</span></button></div>`}
  </form>`;
}

function exportText() {
  const lines = [`Portfolio evidence, exported ${new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`, ''];
  for (const cat of CATEGORIES) {
    const list = state.portfolio.entries.filter((e) => e.category === cat).sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    if (!list.length) continue;
    lines.push(cat);
    for (const e of list) {
      const head = [e.title, e.role ? `(${e.role})` : '', fmtMonth(e.month) ? `, ${fmtMonth(e.month)}` : ''].filter(Boolean).join(' ').replace(' ,', ',');
      lines.push(`• ${head}${e.star ? ' ★' : ''}`);
      if (e.what) lines.push(`  What I did: ${e.what}`);
      if (e.result) lines.push(`  Result: ${e.result}`);
      if (e.skills) lines.push(`  Skills: ${e.skills}`);
      if (e.link) lines.push(`  Link: ${e.link}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** One line for the Today screen. */
export function todaySection() {
  const p = state.portfolio;
  const started = p.courses.filter((c) => c.text.trim()).length;
  const ev = p.entries.length;
  let title = ev ? `${ev} piece${ev === 1 ? '' : 's'} of evidence saved` : 'Start your EAE portfolio';
  if (p.eaeDate) {
    const n = dayDiff(dateKey(), p.eaeDate);
    if (n > 0) title = `EAE applications open in ${n} day${n === 1 ? '' : 's'}`;
    else if (n === 0) title = 'EAE applications open today';
  }
  const sub = `${started} of 3 course write-ups started${p.talents.trim() ? ', talents write-up started' : ''}`;
  return `<section class="section"><div class="section-head"><h2>Portfolio</h2></div>
    <div class="group"><button class="row-btn cta" data-action="tab" data-tab="portfolio">
      <span class="cta-ic cta-folio">${icon('portfolio', 20)}</span>
      <span class="cta-text"><span class="cta-title">${esc(title)}</span><span class="cta-sub">${esc(sub)}</span></span>
      ${icon('chevRight', 16)}</button></div></section>`;
}

/* ---------- Event handlers ---------- */

function updateCounter(el, limit) {
  const num = el.closest('.writeup')?.querySelector('.count-num');
  if (!num) return;
  const n = count(el.value);
  num.textContent = String(n);
  num.classList.toggle('over', n > limit);
}

export const inputs = {
  'folio-text': (el) => {
    state.portfolio.courses[Number(el.dataset.i)].text = el.value;
    save();
    updateCounter(el, COURSE_LIMIT);
  },
  'folio-course': (el) => {
    if (el.value.includes('\n')) el.value = el.value.replace(/\s*\n\s*/g, ' ');
    state.portfolio.courses[Number(el.dataset.i)].course = el.value;
    save();
  },
  'folio-school': (el) => {
    state.portfolio.courses[Number(el.dataset.i)].school = el.value;
    save();
  },
  'folio-talents': (el) => {
    state.portfolio.talents = el.value;
    save();
    updateCounter(el, TALENTS_LIMIT);
  },
  'folio-interview': (el) => {
    state.portfolio.interview[el.dataset.id] = el.value;
    save();
  },
};

export const changes = {
  'folio-eae': (el) => {
    state.portfolio.eaeDate = el.value;
    save();
    refresh();
  },
};

export const actions = {
  'folio-seg': (el) => {
    segment = el.dataset.seg;
    sessionStorage.setItem('hb.folioSeg', segment);
    refresh();
  },

  'folio-copy': async (el) => {
    const p = state.portfolio;
    const text = el.dataset.which === 'talents' ? p.talents : p.courses[Number(el.dataset.i)].text;
    if (!text.trim()) { toast('Nothing to copy yet'); return; }
    toast((await copyText(text)) ? 'Copied' : 'Couldn’t copy. Select the text and copy it instead.');
  },

  'folio-new': () => openSheet(entrySheet(null), { label: 'New evidence' }),

  'folio-edit': (el) => {
    const e = state.portfolio.entries.find((x) => x.id === el.dataset.id);
    if (e) openSheet(entrySheet(e), { label: 'Edit evidence' });
  },

  'folio-star': (el) => {
    const e = state.portfolio.entries.find((x) => x.id === el.dataset.id);
    if (!e) return;
    e.star = !e.star;
    save();
    refresh();
  },

  'folio-delete': (el) => {
    if (!armed(el, 'Tap again to delete')) return;
    state.portfolio.entries = state.portfolio.entries.filter((x) => x.id !== el.dataset.id);
    save();
    closeSheet();
    refresh();
    toast('Deleted');
  },

  'folio-export': async () => {
    toast((await copyText(exportText())) ? 'Copied your evidence as text' : 'Couldn’t copy. Try again.');
  },
};

export const forms = {
  'folio-save': (form, fd) => {
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    const data = {
      title,
      category: CATEGORIES.includes(fd.get('category')) ? fd.get('category') : 'Other',
      month: String(fd.get('month') || ''),
      role: String(fd.get('role') || '').trim(),
      what: String(fd.get('what') || '').trim(),
      result: String(fd.get('result') || '').trim(),
      skills: String(fd.get('skills') || '').trim(),
      link: String(fd.get('link') || '').trim(),
    };
    const id = fd.get('id');
    if (id) {
      const e = state.portfolio.entries.find((x) => x.id === id);
      if (e) Object.assign(e, data);
    } else {
      state.portfolio.entries.push({ id: uid(), ...data, star: false, createdAt: Date.now() });
    }
    save();
    closeSheet();
    if (segment !== 'evidence') {
      segment = 'evidence';
      sessionStorage.setItem('hb.folioSeg', segment);
    }
    refresh();
    toast(id ? 'Saved' : 'Added');
  },
};

export const view = { title: () => 'Portfolio', render };
