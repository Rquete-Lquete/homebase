// All app data lives in one object, saved to localStorage on this device.
// Nothing is sent anywhere. Use Settings > Export a backup to keep a copy.

const KEY = 'homebase.v1';
export const VERSION = '1.0';

export function defaults() {
  return {
    version: 1,
    settings: {
      name: '',
      reminderShortcut: 'Homebase Reminder',
      healthShortcut: 'Homebase Health',
      goals: { steps: 8000, exercise: 30, sleep: 8 },
      setup: { reminder: false, hideCard: false },
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

export function eraseAll() {
  state = defaults();
  saveNow();
}
