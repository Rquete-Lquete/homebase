// Bridges to the iOS Shortcuts app. A web app can't add reminders or read
// Apple Health itself, so it hands that work to two shortcuts the user builds
// once (the in-app Setup guide walks through both).

import { state } from './store.js';
import { openURL, pad, MONTHS } from './ui.js';

/** shortcuts://run-shortcut is Apple's documented URL scheme for running a shortcut. */
export function shortcutURL(name, text) {
  let url = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
  if (text != null) url += `&input=text&text=${encodeURIComponent(text)}`;
  return url;
}

export function runShortcut(name, text) {
  openURL(shortcutURL(name, text));
}

/** "12 Nov 2026 20:00": a format the Get Dates from Input action reads reliably. */
export const fmtForShortcut = (d) =>
  `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const oneLine = (s) => String(s || '').replace(/\s*\n\s*/g, ' ').trim();

/**
 * The reminder shortcut splits its input by new lines:
 * first line = title, last line = date and time, anything between = notes.
 */
export function reminderPayload({ title, notes = '', at }) {
  const lines = [oneLine(title)];
  if (oneLine(notes)) lines.push(oneLine(notes));
  lines.push(fmtForShortcut(at));
  return lines.join('\n');
}

export function sendReminder(reminder) {
  runShortcut(state.settings.reminderShortcut, reminderPayload(reminder));
}

/** The exact lines the Health shortcut's Text action should contain. */
export const HEALTH_TEMPLATE = ['HB1', 'steps=', 'km=', 'kcal=', 'ex=', 'rhr=', 'sleep='].join('\n');
