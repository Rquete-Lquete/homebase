// All app data lives in one object, saved to localStorage on this device.
// Nothing is sent anywhere. Use Settings > Export a backup to keep a copy.

const KEY = 'homebase.v1';
export const VERSION = '3.0';

export function defaults() {
  return {
    version: 1,
    settings: {
      name: '',
      reminderShortcut: 'Homebase Reminder',
      healthShortcut: 'Homebase Health',
      goals: { steps: 8000, exercise: 30, sleep: 8, focus: 60 },
      setup: { reminder: false, hideCard: false },
      area: '',
      subjectColors: {},
    },
    timetable: [],
    grades: [],
    focus: { sessions: [], active: null, lastMinutes: 25 },
    idp: {
      capstone: { title: '', partner: '', mentor: '', role: '', milestones: [], log: [] },
      courses: [],
      dates: [],
    },
    tasks: [],
    bus: { favorites: [] },
    health: { days: {}, lastSync: 0 },
    portfolio: {
      eaeDate: '',
      courses: [
        { course: '', school: 'Ngee Ann Polytechnic', text: '' },
        { course: '', school: 'Ngee Ann Polytechnic', text: '' },
        { course: '', school: 'Ngee Ann Polytechnic', text: '' },
      ],
      talents: '',
      entries: [],
      interview: {},
    },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep-merge saved data over the defaults, so new settings appear after an update. */
function merge(base, saved) {
  if (!isObj(saved)) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    out[k] = isObj(base?.[k]) && isObj(saved[k]) ? merge(base[k], saved[k]) : saved[k];
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (err) {
    console.warn('Homebase: could not read saved data', err);
  }
  return defaults();
}

export let state = load();

let timer = 0;

export function save() {
  clearTimeout(timer);
  timer = setTimeout(saveNow, 150);
}

export function saveNow() {
  clearTimeout(timer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('Homebase: could not save', err);
    window.dispatchEvent(new CustomEvent('hb:save-failed'));
    return false;
  }
}

window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
});

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

export function exportJSON() {
  saveNow();
  return JSON.stringify({ app: 'homebase', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That text isn’t a Homebase backup. Paste the whole backup, from the first { to the last }.');
  }
  const data = parsed && parsed.app === 'homebase' ? parsed.data : parsed;
  if (!isObj(data) || !Array.isArray(data.tasks) || !isObj(data.settings)) {
    throw new Error('That file isn’t a Homebase backup.');
  }
  state = merge(defaults(), data);
  saveNow();
}

/** Subjects the user has typed anywhere, plus a starter list. */
const STARTER_SUBJECTS = ['English', 'Chinese', 'A Math', 'E Math', 'Physics', 'Chemistry', 'Computing', 'Geography', 'Social Studies'];
export function subjects() {
  const used = [
    ...state.timetable.map((l) => l.subject),
    ...state.tasks.map((t) => t.subject),
    ...state.grades.map((g) => g.subject),
  ].filter(Boolean);
  const seen = new Set();
  return [...used, ...STARTER_SUBJECTS].filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Each subject keeps one colour for good: assigned the first time it's used. */
export const SUBJECT_COLORS = ['#FF375F', '#FF9F0A', '#30B0C7', '#34C759', '#5E5CE6', '#BF5AF2', '#0A84FF', '#AC8E68', '#FF6482', '#00C7BE'];
export function subjectColor(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '#8E8E93';
  const map = state.settings.subjectColors;
  if (map[key] == null) {
    map[key] = Object.keys(map).length % SUBJECT_COLORS.length;
    save();
  }
  return SUBJECT_COLORS[map[key] % SUBJECT_COLORS.length];
}

export function eraseAll() {
  state = defaults();
  saveNow();
}
