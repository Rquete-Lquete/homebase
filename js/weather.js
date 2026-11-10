// Weather: NEA's 2-hour forecast for your area, the current temperature and the
// 24-hour outlook, from data.gov.sg's open real-time APIs (no key needed).

import { state, save } from './store.js';
import { esc, openSheet, currentRoute, refresh, fmtTime, pad } from './ui.js';
import { stopInfo, loadStops } from './bus.js';

const API = 'https://api-open.data.gov.sg/v2/real-time/api/';
const FRESH_MS = 10 * 60000;

let data = null; // { at, areas, forecasts, validEnd, temps, day }
let loading = null;

const dist2 = (aLat, aLng, bLat, bLng) => (aLat - bLat) ** 2 + (aLng - bLng) ** 2;
const getJSON = (path) => fetch(API + path).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function load(force = false) {
  if (!force && data && Date.now() - data.at < FRESH_MS) return Promise.resolve(data);
  if (loading) return loading;
  loading = Promise.all([
    getJSON('two-hr-forecast'),
    getJSON('air-temperature').catch(() => null),
    getJSON('twenty-four-hr-forecast').catch(() => null),
  ]).then(([two, temp, day]) => {
    const item = two.data.items[0];
    const stations = temp?.data?.stations || [];
    const readings = temp?.data?.readings?.[0]?.data || [];
    data = {
      at: Date.now(),
      areas: two.data.area_metadata.map((a) => ({ name: a.name, lat: a.label_location.latitude, lng: a.label_location.longitude })),
      forecasts: Object.fromEntries(item.forecasts.map((f) => [f.area, f.forecast])),
      validEnd: item.valid_period?.end || '',
      temps: readings.map((r) => {
        const st = stations.find((s) => s.id === r.stationId);
        return st ? { lat: st.location.latitude, lng: st.location.longitude, value: r.value } : null;
      }).filter(Boolean),
      day: day?.data?.records?.[0] || null,
    };
    return data;
  }).catch(() => data).finally(() => { loading = null; });
  return loading;
}

/** The chosen area, or the one nearest your first saved bus stop, or the middle of town. */
function myArea() {
  if (!data) return null;
  const chosen = data.areas.find((a) => a.name === state.settings.area);
  if (chosen) return chosen;
  const fav = state.bus.favorites[0];
  const stop = fav ? stopInfo(fav.code) : null;
  const at = stop ? [stop.lat, stop.lng] : [1.3521, 103.8198];
  return [...data.areas].sort((a, b) => dist2(a.lat, a.lng, ...at) - dist2(b.lat, b.lng, ...at))[0];
}

export const areaNames = () => (data ? data.areas.map((a) => a.name).sort() : []);

export function kind(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('thunder')) return 'storm';
  if (t.includes('rain') || t.includes('shower') || t.includes('drizzle')) return 'rain';
  if (t.includes('night')) return 'night';
  if (t.includes('cloud') || t.includes('overcast') || t.includes('haz') || t.includes('mist') || t.includes('fog')) return t.includes('partly') ? 'partly' : 'cloud';
  if (t.includes('wind')) return 'cloud';
  return 'sun';
}

export function current() {
  const area = myArea();
  if (!area) return null;
  const text = data.forecasts[area.name] || '';
  const nearest = [...data.temps].sort((a, b) => dist2(a.lat, a.lng, area.lat, area.lng) - dist2(b.lat, b.lng, area.lat, area.lng))[0];
  const end = data.validEnd ? new Date(data.validEnd) : null;
  const k = kind(text);
  return {
    area: area.name,
    text: text.replace(/\s*\((Day|Night)\)/, ''),
    kind: k,
    wet: k === 'rain' || k === 'storm',
    temp: nearest ? Math.round(nearest.value) : null,
    until: end && !Number.isNaN(end.getTime()) ? fmtTime(`${end.getHours()}:${pad(end.getMinutes())}`) : '',
  };
}

/** Small animated weather drawing. */
export function glyph(k, size = 44) {
  const cloud = '<path class="w-cloud" d="M14 34h21a8 8 0 0 0 1.2-15.9A11 11 0 0 0 15.2 20 7.2 7.2 0 0 0 14 34z"/>';
  const sun = (cx, cy, r) => `<g class="w-sun"><circle cx="${cx}" cy="${cy}" r="${r}"/><g class="w-rays" style="transform-origin:${cx}px ${cy}px">${
    Array.from({ length: 8 }, (_, i) => `<line x1="${cx}" y1="${cy - r - 3}" x2="${cx}" y2="${cy - r - 7}" transform="rotate(${i * 45} ${cx} ${cy})"/>`).join('')}</g></g>`;
  const drops = '<g class="w-drops"><line x1="17" y1="38" x2="15" y2="44"/><line x1="25" y1="38" x2="23" y2="44"/><line x1="33" y1="38" x2="31" y2="44"/></g>';
  const bolt = '<path class="w-bolt" d="M26 33l-5 8h5l-2 7 7-10h-5l3-5z"/>';
  const moon = '<path class="w-moon" d="M31 9a12 12 0 1 0 9 19.5A10 10 0 0 1 31 9z"/>';
  const body = {
    sun: sun(24, 24, 9),
    partly: sun(32, 15, 7) + cloud,
    cloud,
    rain: cloud + drops,
    storm: cloud + bolt + '<g class="w-drops"><line x1="15" y1="38" x2="13" y2="44"/><line x1="35" y1="38" x2="33" y2="44"/></g>',
    night: moon,
  }[k] || cloud;
  return `<svg class="wx wx-${k}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}

export function tileHTML() {
  const w = current();
  if (!w) {
    return `<button class="tile-btn wx-tile" data-action="wx-open"><span class="tl-label">Weather</span>
      <span class="tl-main small">${navigator.onLine === false ? 'Offline' : 'Loading…'}</span></button>`;
  }
  return `<button class="tile-btn wx-tile${w.wet ? ' wet' : ''}" data-action="wx-open" aria-label="Weather in ${esc(w.area)}: ${esc(w.text)}${w.temp != null ? `, ${w.temp} degrees` : ''}">
    <span class="tl-top">${glyph(w.kind)}${w.temp != null ? `<span class="wx-temp">${w.temp}°</span>` : ''}</span>
    <span class="tl-main">${esc(w.text)}</span>
    <span class="tl-sub">${w.wet ? 'Bring an umbrella. ' : ''}${esc(w.area)}${w.until ? `, to ${esc(w.until)}` : ''}</span></button>`;
}

function sheetHTML() {
  const w = current();
  if (!w) return `<div class="sheet-head"><button class="link" data-action="sheet-close">Close</button><h2>Weather</h2><span></span></div>
    <p class="sheet-text pad">Couldn’t load the forecast. Check your connection and try again.</p>`;
  const g = data.day?.general;
  const region = (() => {
    const centres = { north: [1.418, 103.82], south: [1.296, 103.82], east: [1.357, 103.94], west: [1.357, 103.7], central: [1.357, 103.82] };
    const a = data.areas.find((x) => x.name === w.area);
    return Object.keys(centres).sort((p, q) => dist2(a.lat, a.lng, ...centres[p]) - dist2(a.lat, a.lng, ...centres[q]))[0];
  })();
  const periods = (data.day?.periods || []).map((p) => {
    const f = p.regions?.[region];
    const label = String(p.timePeriod?.text || '').replace(/\s+\d+\s+\w+$/, '');
    return f ? `<div class="row wx-row">${glyph(kind(f.text), 30)}<span class="wx-when">${esc(label)}</span><span class="muted">${esc(f.text)}</span></div>` : '';
  }).join('');
  const options = ['', ...areaNames()].map((n) => `<option value="${esc(n)}"${n === state.settings.area ? ' selected' : ''}>${n ? esc(n) : 'Nearest to my first saved stop'}</option>`).join('');
  return `<div class="sheet-head"><button class="link" data-action="sheet-close">Close</button><h2>${esc(w.area)}</h2><span></span></div>
    <div class="wx-hero">${glyph(w.kind, 84)}<div><p class="wx-big">${w.temp != null ? `${w.temp}°` : ''} ${esc(w.text)}</p>
      <p class="muted">${w.until ? `Forecast to ${esc(w.until)}` : ''}${g ? `. Today ${g.temperature.low}° to ${g.temperature.high}°` : ''}</p></div></div>
    ${periods ? `<p class="group-label">Coming up (${esc(region)})</p><div class="group">${periods}</div>` : ''}
    <p class="group-label">Area</p>
    <div class="group"><label class="field"><span>Show weather for</span><select data-change="wx-area">${options}</select></label></div>
    <p class="hint">Forecasts are from the National Environment Agency, through data.gov.sg.</p>`;
}

function repaint() {
  document.querySelectorAll('[data-wx-slot]').forEach((el) => { el.innerHTML = tileHTML(); });
}

/** Loads the forecast (and the stop list, for picking the nearest area), then fills the tile. */
export function refreshTile(force = false) {
  const stopsReady = state.bus.favorites.length ? loadStops().catch(() => null) : Promise.resolve();
  return Promise.all([load(force), stopsReady]).then(repaint);
}

export function init() {
  setInterval(() => { if (!document.hidden && currentRoute() === 'today') refreshTile(); }, 5 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentRoute() === 'today') refreshTile(); });
}

export const actions = {
  'wx-open': () => {
    openSheet(sheetHTML(), { label: 'Weather' });
    load().then(() => {});
  },
};

export const changes = {
  'wx-area': (el) => {
    state.settings.area = el.value;
    save();
    openSheet(sheetHTML(), { label: 'Weather' });
    if (currentRoute() === 'today') refresh();
  },
};
