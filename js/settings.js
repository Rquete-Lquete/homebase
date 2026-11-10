// Settings and the setup guide (Home Screen, reminders shortcut, Health shortcut).

import { state, save, saveNow, exportJSON, importJSON, eraseAll, VERSION } from './store.js';
import {
  esc, icon, pageHeader, dateKey, isStandalone, toast, openSheet, closeSheet, refresh, copyText, armed,
} from './ui.js';
import { runShortcut, reminderPayload, HEALTH_TEMPLATE } from './shortcuts.js';

/* ---------- Settings ---------- */

function renderSettings() {
  const s = state.settings;
  return `${pageHeader('Settings', { back: { route: 'today', label: 'Today' } })}
    <section class="section"><div class="group">
      <label class="field"><span>Your name</span><input name="name" maxlength="40" placeholder="For the greeting" value="${esc(s.name)}" data-input="settings-field" autocomplete="given-name"></label>
    </div></section>

    <section class="section"><div class="section-head"><h2>Shortcuts</h2></div>
      <div class="group">
        <label class="field"><span>Reminders</span><input name="reminderShortcut" maxlength="60" value="${esc(s.reminderShortcut)}" data-input="settings-field" autocapitalize="words"></label>
        <label class="field"><span>Health</span><input name="healthShortcut" maxlength="60" value="${esc(s.healthShortcut)}" data-input="settings-field" autocapitalize="words"></label>
        <button class="row-btn" data-action="go-guide">${icon('book', 20)}<span class="lbl">Setup guide</span></button>
      </div>
      <p class="hint section-hint">The names must match your shortcuts in the Shortcuts app exactly.</p></section>

    <section class="section"><div class="section-head"><h2>Daily goals</h2></div>
      <div class="group">
        <label class="field"><span>Steps</span><input name="goal-steps" type="number" inputmode="numeric" min="500" max="60000" step="500" value="${s.goals.steps}" data-input="settings-field"></label>
        <label class="field"><span>Exercise (minutes)</span><input name="goal-exercise" type="number" inputmode="numeric" min="5" max="300" step="5" value="${s.goals.exercise}" data-input="settings-field"></label>
        <label class="field"><span>Sleep (hours)</span><input name="goal-sleep" type="number" inputmode="decimal" min="4" max="14" step="0.5" value="${s.goals.sleep}" data-input="settings-field"></label>
      </div></section>

    <section class="section"><div class="section-head"><h2>Your data</h2></div>
      <div class="group">
        <button class="row-btn" data-action="data-export">${icon('share', 20)}<span class="lbl">Export a backup</span></button>
        <button class="row-btn" data-action="data-import">${icon('download', 20)}<span class="lbl">Restore from a backup</span></button>
      </div>
      <p class="hint section-hint">Everything is stored on this iPhone, inside Homebase. Removing Homebase from your Home Screen deletes it, so export a backup now and then.</p>
      <div class="group gap-top"><button class="row-btn danger" data-action="data-erase">${icon('trash', 20)}<span class="lbl">Erase all data</span></button></div>
    </section>

    <section class="section"><div class="group">
      ${s.setup.hideCard ? `<button class="row-btn" data-action="setup-show"><span class="lbl">Show the setup checklist on Today</span></button>` : ''}
      <div class="row about"><span>Version</span><span class="muted">${esc(VERSION)}</span></div>
    </div></section>
    <p class="credit">Bus arrival times are from LTA DataMall through the ArriveLah API. Bus stops are from BusRouter SG.</p>`;
}

function importSheetHTML(message = '') {
  return `<div class="sheet-head"><button class="link" data-action="sheet-close">Cancel</button><h2>Restore a backup</h2><span></span></div>
    <div class="sheet-pad">
      <p class="sheet-text">Restoring replaces everything in Homebase with what’s in the backup.</p>
      <label class="btn btn-large file-btn">${icon('download', 20)}Choose a backup file
        <input type="file" accept="application/json,.json,text/plain" data-change="data-file"></label>
      <textarea id="import-text" class="field-input boxed" rows="6" placeholder="Or paste the backup text here" aria-label="Backup text"></textarea>
      ${message ? `<p class="error" role="alert">${esc(message)}</p>` : ''}
      <button class="btn btn-large btn-primary" data-action="data-import-go"><span class="lbl">Restore</span></button>
    </div>`;
}

/* ---------- Setup guide ---------- */

function step(html) {
  return `<li>${html}</li>`;
}

function renderGuide() {
  const s = state.settings;
  const rName = esc(s.reminderShortcut);
  const hName = esc(s.healthShortcut);
  const home = isStandalone()
    ? '<p class="guide-text">You’re using Homebase from your Home Screen, so this part is done.</p>'
    : `<ol class="guide-steps">
        ${step('Open this page in <b>Safari</b>.')}
        ${step('Tap <b>Share</b>. On iOS 26 it can be inside the <b>•••</b> menu next to the address bar.')}
        ${step('Tap <b>Add to Home Screen</b>, leave <b>Open as Web App</b> on, then tap <b>Add</b>.')}
        ${step('Open Homebase from its new icon and do the rest of the setup there. The Home Screen app keeps its own data, separate from Safari.')}
      </ol>`;

  return `${pageHeader('Setup guide', { back: { route: 'today', label: 'Today' } })}
    <p class="intro">Homebase is a web app, so two jobs go through Apple’s Shortcuts app: adding reminders that alert you when Homebase is closed, and reading Apple Health. Each shortcut takes about five minutes to build, once.</p>

    <section class="section" id="g-home"><div class="section-head"><h2>Home Screen</h2></div>
      <div class="group guide">${home}</div></section>

    <section class="section" id="g-reminders"><div class="section-head"><h2>Reminders shortcut</h2></div>
      <div class="group guide">
        <p class="guide-text">When you turn on <b>Remind me</b> for a task, Homebase sends it to a shortcut named “${rName}”, which adds it to Apple Reminders with an alert.</p>
        <ol class="guide-steps">
          ${step(`Open <b>Shortcuts</b> and tap <b>+</b>. Tap the name at the top, choose <b>Rename</b> and type <b>${rName}</b>.`)}
          ${step('Add the <b>Split Text</b> action. Tap <b>Text</b> inside it and choose <b>Shortcut Input</b>. Leave it splitting by <b>New Lines</b>.')}
          ${step('Add <b>Get Item from List</b> and set it to <b>First Item</b>. That’s the title.')}
          ${step('Add another <b>Get Item from List</b> and set it to <b>Last Item</b>. That’s the date and time.')}
          ${step('Add <b>Get Dates from Input</b>. It picks up the last item by itself.')}
          ${step('Add <b>Add New Reminder</b> (some iOS versions call it <b>Create Reminder</b>). Set its title to the first <b>Item from List</b> and pick a list. Tap the arrow for more options, turn on the alert or due date, and set it to <b>Dates</b>.')}
          ${step('Tap <b>Done</b>, come back here and send a test.')}
        </ol>
        <div class="guide-actions">
          <button class="btn btn-primary" data-action="guide-test-reminder">${icon('bell', 16)}Send a test reminder</button>
          <button class="btn" data-action="guide-reminder-ok">${s.setup.reminder ? `${icon('check', 16)}Working` : 'It worked'}</button>
        </div>
        <p class="guide-note">The test asks for an alert two minutes from now. After a shortcut runs, tap <b>‹ Homebase</b> at the top-left of the screen to come back. Ticking off a task in Homebase doesn’t tick it off in Reminders.</p>
      </div></section>

    <section class="section" id="g-health"><div class="section-head"><h2>Apple Health shortcut</h2></div>
      <div class="group guide">
        <p class="guide-text">Homebase can’t open Apple Health itself. A shortcut named “${hName}” reads today’s numbers and copies them, and Homebase pastes them in.</p>
        <ol class="guide-steps">
          ${step(`In Shortcuts, tap <b>+</b> and rename the new shortcut <b>${hName}</b>.`)}
          ${step('Add <b>Find Health Samples</b>. Set <b>Type</b> to <b>Steps</b> and <b>Start Date</b> to <b>is today</b>. Tap the arrow and set <b>Group By</b> to <b>Day</b>.')}
          ${step('Add three more <b>Find Health Samples</b> set up the same way, for <b>Walking + Running Distance</b>, <b>Active Energy</b> and <b>Exercise Minutes</b>.')}
          ${step('Add one for <b>Resting Heart Rate</b>. Sort by <b>Start Date</b>, set <b>Order</b> to <b>Latest First</b>, and turn on <b>Limit</b> with 1.')}
          ${step('Sleep is optional and needs an Apple Watch or a sleep-tracking app. Add <b>Find Health Samples</b> for <b>Sleep Analysis</b>, <b>Start Date</b> in the last 1 day, with two filters: <b>Value is not In Bed</b> and <b>Value is not Awake</b>. Then add <b>Get Details of Health Samples</b> set to <b>Duration</b>, and <b>Calculate Statistics</b> set to <b>Sum</b>.')}
          ${step('Add a <b>Text</b> action and type the lines below. After each <b>=</b>, tap <b>Select Variable</b> and tap the action that found that number. For sleep, pick <b>Statistics</b>.')}
        </ol>
        <pre class="code">${esc(HEALTH_TEMPLATE)}</pre>
        <div class="guide-actions"><button class="btn" data-action="guide-copy-template">${icon('copy', 16)}Copy these lines</button></div>
        <ol class="guide-steps" start="7">
          ${step('Add <b>Copy to Clipboard</b>. It copies the text above.')}
          ${step('Run the shortcut once inside Shortcuts and allow access to every Health type it asks about.')}
        </ol>
        <p class="guide-note">To sync, tap <b>Sync</b> on the Health screen. The shortcut runs, then tap <b>‹ Homebase</b> at the top-left and tap <b>Paste</b>. A type with no data today is simply left blank.</p>
        <div class="guide-actions"><button class="btn btn-primary" data-action="health-sync">${icon('refresh', 16)}Sync now</button>
          <button class="btn" data-action="health-open-paste">${icon('paste', 16)}Paste</button></div>
      </div></section>

    <section class="section" id="g-tips"><div class="section-head"><h2>Good to know</h2></div>
      <div class="group guide"><ul class="guide-list">
        <li>Your data lives only on this iPhone. Export a backup from Settings now and then.</li>
        <li>For <b>Stops near me</b>, allow location when asked. If you said no, turn it on in Settings > Privacy & Security > Location Services.</li>
        <li>Bus times refresh every 30 seconds while a board is on screen.</li>
      </ul></div></section>`;
}

function mountGuide(root, opts = {}) {
  if (opts.section) {
    requestAnimationFrame(() => {
      const el = root.querySelector(`#g-${opts.section}`);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70);
    });
  }
}

/* ---------- Event handlers ---------- */

export const inputs = {
  'settings-field': (el) => {
    const s = state.settings;
    const v = el.value;
    const num = (x) => Number.parseFloat(x);
    switch (el.name) {
      case 'name': s.name = v.trim(); break;
      case 'reminderShortcut': s.reminderShortcut = v.trim() || 'Homebase Reminder'; break;
      case 'healthShortcut': s.healthShortcut = v.trim() || 'Homebase Health'; break;
      case 'goal-steps': if (num(v) > 0) s.goals.steps = Math.round(num(v)); break;
      case 'goal-exercise': if (num(v) > 0) s.goals.exercise = Math.round(num(v)); break;
      case 'goal-sleep': if (num(v) > 0) s.goals.sleep = num(v); break;
      default: return;
    }
    save();
  },
};

export const changes = {
  'data-file': async (el) => {
    const file = el.files?.[0];
    if (!file) return;
    const text = await file.text();
    const box = document.getElementById('import-text');
    if (box) box.value = text;
    toast('Backup loaded. Tap Restore to use it.');
  },
};

export const actions = {
  'setup-show': () => {
    state.settings.setup.hideCard = false;
    save();
    refresh();
  },

  'data-export': async () => {
    const json = exportJSON();
    const name = `homebase-backup-${dateKey()}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Homebase backup' });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    if (await copyText(json)) toast('Backup copied. Paste it into Notes or a file to keep it.', { duration: 4500 });
    else toast('Couldn’t export. Try again.');
  },

  'data-import': () => openSheet(importSheetHTML(), { label: 'Restore a backup' }),

  'data-import-go': (el) => {
    const text = document.getElementById('import-text')?.value || '';
    if (!text.trim()) {
      toast('Choose a backup file or paste the backup text first.');
      return;
    }
    if (!armed(el, 'Tap again to replace your data')) return;
    try {
      importJSON(text);
    } catch (err) {
      openSheet(importSheetHTML(err.message), { label: 'Restore a backup' });
      return;
    }
    closeSheet();
    refresh();
    toast('Backup restored');
  },

  'data-erase': (el) => {
    if (!armed(el, 'Tap again to erase everything')) return;
    eraseAll();
    saveNow();
    refresh();
    toast('All data erased');
  },

  'guide-test-reminder': () => {
    const at = new Date(Date.now() + 2 * 60000);
    runShortcut(state.settings.reminderShortcut, reminderPayload({ title: 'Test reminder from Homebase', notes: 'If this alert shows up, reminders are working.', at }));
  },

  'guide-reminder-ok': () => {
    state.settings.setup.reminder = true;
    save();
    refresh();
    toast('Reminders are set up');
  },

  'guide-copy-template': async () => {
    toast((await copyText(HEALTH_TEMPLATE)) ? 'Copied. Paste it into the Text action.' : 'Couldn’t copy. Type the lines instead.');
  },
};

export const view = { title: () => 'Settings', render: renderSettings };
export const guideView = { title: () => 'Setup guide', render: renderGuide, mount: mountGuide };
