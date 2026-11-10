// Bus: live arrival times for Singapore bus stops, saved stops, search and nearby.
// Arrivals come from ArriveLah (a free proxy for LTA DataMall's Bus Arrival API);
// the stop list comes from BusRouter SG's open data (code -> [lng, lat, name, road]).
// Both allow requests from any website, so no API key or server is needed.

import { state, save } from './store.js';
import {
  esc, icon, pageHeader, toast, openSheet, updateSheet, closeSheet, sheetIsOpen, refresh, currentRoute,
  fmtClock, debounce, armed,
} from './ui.js';

const STOPS_URL = 'https://data.busrouter.sg/v1/stops.min.json';
const ARRIVALS_URL = (code) => `https://arrivelah2.busrouter.sg/?id=${encodeURIComponent(code)}`;
const REFRESH_MS = 30000;
const FRESH_MS = 20000;

const LOAD = { SEA: 'seats available', SDA: 'standing room', LSD: 'limited standing' };
const KIND = { SD: 'single deck', DD: 'double deck', BD: 'bendy bus' };

let stops = null;
let stopsPromise = null;
const arrivals = new Map(); // code -> { at, okAt, services, error }
const inflight = new Map();

let query = '';
let mode = 'search'; // 'search' | 'nearby'
let nearby = null;
let sheetCode = null;
let lastRemoved = null;

/* ---------- Data ---------- */

export function loadStops() {
  if (stops) return Promise.resolve(stops);
  if (!stopsPromise) {
    stopsPromise = fetch(STOPS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => (stops = json))
      .catch((err) => {
        stopsPromise = null;
        throw err;
      });
  }
  return stopsPromise;
}

export function stopInfo(code) {
  const s = stops?.[code];
  return s ? { code, lng: s[0], lat: s[1], name: s[2], road: s[3] } : null;
}

const svcCompare = (a, b) => {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (na !== nb) return (Number.isNaN(na) ? 1e9 : na) - (Number.isNaN(nb) ? 1e9 : nb);
  return a.localeCompare(b);
};

function normalise(json) {
  return (json?.services || [])
    .map((s) => ({
      no: String(s.no),
      buses: [s.next, s.next2, s.next3]
        .filter((b) => b && b.time)
        .map((b) => ({
          t: Date.parse(b.time),
          load: b.load,
          kind: b.type,
          live: b.monitored !== 0,
          dest: b.destination_code,
          origin: b.origin_code,
        }))
        .filter((b) => !Number.isNaN(b.t)),
    }))
    .sort((a, b) => svcCompare(a.no, b.no));
}

export function getArrivals(code, { force = false } = {}) {
  const cached = arrivals.get(code);
  if (!force && cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached);
  if (inflight.has(code)) return inflight.get(code);
  const p = fetch(ARRIVALS_URL(code), { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json) => {
      const v = { at: Date.now(), okAt: Date.now(), services: normalise(json), error: null };
      arrivals.set(code, v);
      return v;
    })
    .catch(() => {
      const v = {
        at: Date.now(),
        okAt: cached?.okAt || 0,
        services: cached?.services || null,
        error: navigator.onLine === false ? 'offline' : 'failed',
      };
      arrivals.set(code, v);
      return v;
    })
    .finally(() => inflight.delete(code));
  inflight.set(code, p);
  return p;
}

/* ---------- Arrival board (the LED panel) ---------- */

export function etaText(t, now = Date.now()) {
  if (!t) return '–';
  const mins = Math.floor((t - now) / 60000);
  return mins < 1 ? 'Arr' : String(mins);
}

function etaSpoken(b) {
  const text = etaText(b.t);
  const when = text === 'Arr' ? 'arriving now' : `in ${text} minute${text === '1' ? '' : 's'}`;
  return [when, LOAD[b.load], KIND[b.kind], b.live ? '' : 'timetable estimate'].filter(Boolean).join(', ');
}

function destName(service) {
  const b = service.buses[0];
  if (!b) return '';
  if (b.dest && b.dest === b.origin) return 'Loop';
  const info = b.dest ? stopInfo(b.dest) : null;
  return info ? info.name : '';
}

function etaHTML(b, i) {
  if (!b) return '<span class="eta none" aria-hidden="true">–</span>';
  return `<span class="eta${i ? ' later' : ''}${b.live ? '' : ' sched'}">
    <span class="glow" aria-hidden="true"><span class="led" data-eta="${b.t}">${etaText(b.t)}</span></span>
    <i class="load load-${esc(b.load || 'NA')}" aria-hidden="true"></i><span class="sr">${esc(etaSpoken(b))}</span></span>`;
}

const filterList = (fav) => (fav?.services || []).map((s) => s.toLowerCase());

function rowsHTML(code, services, compact) {
  const c = arrivals.get(code);
  if (!c) return '<p class="board-msg">Loading arrival times…</p>';
  if (!c.services) {
    return `<p class="board-msg">${c.error === 'offline'
      ? 'You’re offline. Arrival times need an internet connection.'
      : 'Couldn’t load arrival times.'} <button class="board-retry" data-action="bus-retry" data-code="${esc(code)}">Try again</button></p>`;
  }
  let list = c.services;
  if (services.length) list = list.filter((s) => services.includes(s.no.toLowerCase()));
  if (!list.length) {
    return `<p class="board-msg">${services.length
      ? 'None of your chosen buses are on their way right now.'
      : 'No buses are expected at this stop right now.'}</p>`;
  }
  const n = compact ? 2 : 3;
  const rows = list.map((s) => {
    const dest = destName(s);
    return `<div class="brow">
      <span class="glow svc-wrap" aria-hidden="true"><span class="led svc">${esc(s.no)}</span></span>
      <span class="dest"><span class="sr">Bus ${esc(s.no)}${dest ? ` to ${esc(dest)}` : ''}: </span><span aria-hidden="true">${esc(dest)}</span></span>
      ${Array.from({ length: n }, (_, i) => etaHTML(s.buses[i], i)).join('')}
    </div>`;
  }).join('');
  const stale = c.error && c.okAt ? `<p class="board-msg small">Showing times from ${fmtClock(new Date(c.okAt))}. Couldn’t refresh.</p>` : '';
  return rows + stale;
}

export function boardHTML(code, { fav = null, compact = false, head = true } = {}) {
  const info = stopInfo(code);
  const name = fav?.name || info?.name || `Stop ${code}`;
  const road = fav?.road || info?.road || '';
  const title = fav?.label || name;
  const sub = fav?.label ? `${name}, ${code}` : [road, code].filter(Boolean).join(', ');
  const services = filterList(fav);
  return `<div class="board${compact ? ' compact' : ''}${head ? '' : ' headless'}" data-board="${esc(code)}" data-filter="${esc(services.join(','))}">
    ${head ? `<button class="board-head" data-action="bus-open" data-code="${esc(code)}">
      <span class="bh-title">${esc(title)}</span><span class="bh-sub">${esc(sub)}</span></button>` : ''}
    <div class="board-rows">${rowsHTML(code, services, compact)}</div>
  </div>`;
}

export function updateBoards() {
  document.querySelectorAll('[data-board]').forEach((el) => {
    const rows = el.querySelector('.board-rows');
    const services = el.dataset.filter ? el.dataset.filter.split(',') : [];
    if (rows) rows.innerHTML = rowsHTML(el.dataset.board, services, el.classList.contains('compact'));
  });
}

function tickEtas() {
  document.querySelectorAll('[data-eta]').forEach((el) => {
    el.textContent = etaText(Number(el.dataset.eta));
  });
}

/** Fetch arrivals for every board on screen (cached ones are reused unless forced). */
export function refreshVisible(force = false) {
  const codes = [...new Set([...document.querySelectorAll('[data-board]')].map((el) => el.dataset.board))];
  if (!codes.length) return Promise.resolve();
  return Promise.all(codes.map((c) => getArrivals(c, { force }))).then(updateBoards);
}

let polling = false;
export function startPolling() {
  if (polling) return;
  polling = true;
  setInterval(() => { if (!document.hidden) refreshVisible(true); }, REFRESH_MS);
  setInterval(() => { if (!document.hidden) tickEtas(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshVisible(true); });
  if (state.bus.favorites.length) loadStops().then(updateBoards).catch(() => {});
}

/* ---------- Search and nearby ---------- */

const SYNONYMS = {
  station: 'stn', interchange: 'int', opposite: 'opp', before: 'bef', after: 'aft', block: 'blk',
  road: 'rd', avenue: 'ave', street: 'st', school: 'sch', primary: 'pr', secondary: 'sec', polytechnic: 'poly',
  terminal: 'ter', centre: 'ctr', center: 'ctr', building: 'bldg', junction: 'jct',
};

function searchStops(q) {
  const s = q.trim().toLowerCase();
  if (!s || !stops) return [];
  const out = [];
  if (/^\d+$/.test(s)) {
    for (const code of Object.keys(stops)) {
      if (code.startsWith(s)) out.push(stopInfo(code));
      if (out.length >= 30) break;
    }
    return out;
  }
  const words = s.split(/\s+/).map((w) => SYNONYMS[w] || w);
  for (const code of Object.keys(stops)) {
    const [, , name, road] = stops[code];
    const hay = `${name} ${road}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(stopInfo(code));
    if (out.length >= 30) break;
  }
  return out;
}

function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const fmtDist = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);
const isFav = (code) => state.bus.favorites.some((f) => f.code === code);

function stopRowHTML(s, dist) {
  const saved = isFav(s.code);
  const meta = [s.road, s.code, dist != null ? fmtDist(dist) : ''].filter(Boolean).join(', ');
  return `<div class="row stop-row">
    <button class="row-main" data-action="bus-open" data-code="${esc(s.code)}">
      <span class="t-title">${esc(s.name)}</span><span class="t-meta">${esc(meta)}</span></button>
    <button class="star${saved ? ' on' : ''}" data-action="bus-fav-toggle" data-code="${esc(s.code)}" aria-pressed="${saved}"
      aria-label="${saved ? 'Remove' : 'Save'} ${esc(s.name)}">${icon(saved ? 'starFill' : 'star', 22)}</button>
  </div>`;
}

function resultsHTML() {
  if (mode === 'nearby' && nearby) {
    const close = '<button class="link" data-action="bus-clear">Done</button>';
    if (nearby.status === 'loading') return `<div class="results-head"><h3>Near you</h3>${close}</div><p class="muted pad">Finding your location…</p>`;
    if (nearby.status === 'error') return `<div class="results-head"><h3>Near you</h3>${close}</div><p class="muted pad">${esc(nearby.msg)}</p>`;
    return `<div class="results-head"><h3>Near you</h3>${close}</div>
      <div class="group">${nearby.list.map((n) => stopRowHTML(stopInfo(n.code), n.d)).join('')}</div>`;
  }
  if (!query.trim()) return '';
  if (!stops) {
    loadStops().then(updateResults).catch(() => {
      const box = document.getElementById('bus-results');
      if (box) box.innerHTML = '<p class="muted pad">Couldn’t load the list of bus stops. Check your connection and try again.</p>';
    });
    return '<p class="muted pad">Loading bus stops…</p>';
  }
  const res = searchStops(query);
  if (!res.length) return `<p class="muted pad">No stops match “${esc(query.trim())}”. Try the 5-digit code on the bus stop pole.</p>`;
  return `<div class="group">${res.map((s) => stopRowHTML(s)).join('')}</div>`;
}

function updateResults() {
  const box = document.getElementById('bus-results');
  if (box) box.innerHTML = resultsHTML();
}

/* ---------- Screens ---------- */

function render() {
  const favs = state.bus.favorites;
  const saved = favs.length
    ? favs.map((f) => `<div class="fav">${boardHTML(f.code, { fav: f })}
        <button class="fav-edit" data-action="bus-fav-edit" data-code="${esc(f.code)}" aria-label="Edit ${esc(f.label || f.name || f.code)}">${icon('pencil', 16)}</button></div>`).join('')
    : `<div class="empty small"><p>Save the stops you use every day. They’ll show up here and on Today with live arrival times.</p></div>`;
  return `${pageHeader('Bus')}
    <div class="searchbar">${icon('search', 18)}
      <input type="search" id="bus-q" placeholder="Stop name, road or 5-digit code" aria-label="Search bus stops"
        value="${esc(query)}" data-input="bus-search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></div>
    <div class="bus-tools"><button class="btn" data-action="bus-nearby">${icon('location', 16)}Stops near me</button></div>
    <div id="bus-results">${resultsHTML()}</div>
    <section class="section">
      <div class="section-head"><h2>Saved stops</h2>${favs.length ? '<button class="link" data-action="bus-refresh">Refresh</button>' : ''}</div>
      ${saved}
    </section>
    <p class="credit">Arrival times are from LTA DataMall, through the ArriveLah API. The stop list is from BusRouter SG.</p>`;
}

function stopSheetHTML(code) {
  const info = stopInfo(code);
  const fav = state.bus.favorites.find((f) => f.code === code);
  const name = fav?.name || info?.name || `Stop ${code}`;
  const road = fav?.road || info?.road || '';
  return `<div class="sheet-head">
      <button class="link" data-action="sheet-close">Close</button>
      <h2>${esc(fav?.label || name)}</h2>
      <button class="star head-star${fav ? ' on' : ''}" data-action="bus-fav-toggle" data-code="${esc(code)}" aria-pressed="${Boolean(fav)}"
        aria-label="${fav ? 'Remove from saved stops' : 'Save this stop'}">${icon(fav ? 'starFill' : 'star', 24)}</button>
    </div>
    <p class="sheet-sub">${esc([fav?.label ? name : '', road, code].filter(Boolean).join(', '))}</p>
    <div class="sheet-pad">${boardHTML(code, { fav: null, head: false })}</div>
    <div class="legend"><span><i class="load load-SEA"></i>Seats</span><span><i class="load load-SDA"></i>Standing</span><span><i class="load load-LSD"></i>Limited standing</span></div>
    <p class="hint">Times are in minutes. Dimmed times come from the timetable because that bus isn’t sending its location. Times refresh every 30 seconds.</p>`;
}

function favSheetHTML(fav) {
  const i = state.bus.favorites.indexOf(fav);
  const last = state.bus.favorites.length - 1;
  const show = [['always', 'Always'], ['am', 'Mornings'], ['pm', 'Afternoons'], ['never', 'Never']];
  return `<form data-form="bus-fav-save" class="sheet-form" autocomplete="off">
    <input type="hidden" name="code" value="${esc(fav.code)}">
    <div class="sheet-head">
      <button type="button" class="link" data-action="sheet-close">Cancel</button><h2>Edit stop</h2>
      <button type="submit" class="link strong">Done</button></div>
    <p class="sheet-sub">${esc([fav.name, fav.road, fav.code].filter(Boolean).join(', '))}</p>
    <div class="group">
      <label class="field"><span>Name</span><input name="label" maxlength="30" placeholder="Home, School…" value="${esc(fav.label)}"></label>
      <label class="field"><span>Buses</span><input name="services" maxlength="60" placeholder="All" value="${esc((fav.services || []).join(', '))}" autocapitalize="off"></label>
    </div>
    <p class="hint">To hide the buses you never take, list the ones you do, separated by commas.</p>
    <p class="group-label">Show on Today</p>
    <div class="segmented" role="radiogroup" aria-label="Show on Today">${show.map(([v, l]) =>
      `<label><input type="radio" name="show" value="${v}"${(fav.show || 'always') === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <p class="hint">Mornings means before noon. Put your home stop on Mornings and your school stop on Afternoons.</p>
    <div class="group">
      ${i > 0 ? `<button type="button" class="row-btn" data-action="bus-fav-move" data-code="${esc(fav.code)}" data-dir="-1">${icon('arrowUp', 20)}<span class="lbl">Move up</span></button>` : ''}
      ${i < last ? `<button type="button" class="row-btn" data-action="bus-fav-move" data-code="${esc(fav.code)}" data-dir="1">${icon('arrowDown', 20)}<span class="lbl">Move down</span></button>` : ''}
      <button type="button" class="row-btn danger" data-action="bus-fav-remove" data-code="${esc(fav.code)}">${icon('trash', 20)}<span class="lbl">Remove stop</span></button>
    </div>
  </form>`;
}

/** Saved stops to show on Today, chosen by time of day. */
export function todaySection() {
  const favs = state.bus.favorites;
  if (!favs.length) {
    return `<section class="section"><div class="section-head"><h2>Buses</h2></div>
      <div class="group"><button class="row-btn cta" data-action="tab" data-tab="bus">
        <span class="cta-ic cta-bus">${icon('bus', 20)}</span>
        <span class="cta-text"><span class="cta-title">Add your bus stops</span><span class="cta-sub">See live arrivals here before you leave.</span></span>
        ${icon('chevRight', 16)}</button></div></section>`;
  }
  const period = new Date().getHours() < 12 ? 'am' : 'pm';
  let pick = favs.filter((f) => (f.show || 'always') === 'always' || f.show === period);
  if (!pick.length) pick = favs.filter((f) => f.show !== 'never');
  if (!pick.length) return '';
  return `<section class="section"><div class="section-head"><h2>Buses</h2><button class="link" data-action="tab" data-tab="bus">All stops</button></div>
    <div class="boards">${pick.slice(0, 2).map((f) => boardHTML(f.code, { fav: f, compact: true })).join('')}</div></section>`;
}

/* ---------- Event handlers ---------- */

function openStop(code) {
  sheetCode = code;
  openSheet(stopSheetHTML(code), { label: 'Bus stop', onClose: () => { sheetCode = null; } });
  getArrivals(code, { force: true }).then(updateBoards);
  if (!stops) loadStops().then(() => { if (sheetCode === code) { updateSheet(stopSheetHTML(code)); updateBoards(); } }).catch(() => {});
}

function afterFavChange() {
  if (sheetIsOpen() && sheetCode) {
    updateSheet(stopSheetHTML(sheetCode));
    updateBoards();
  }
  if (currentRoute() === 'bus' || currentRoute() === 'today') refresh();
}

export const actions = {
  'bus-open': (el) => openStop(el.dataset.code),

  'bus-retry': (el) => getArrivals(el.dataset.code, { force: true }).then(updateBoards),

  'bus-refresh': () => {
    refreshVisible(true);
    toast('Refreshing arrival times');
  },

  'bus-fav-toggle': (el) => {
    const code = el.dataset.code;
    const list = state.bus.favorites;
    const i = list.findIndex((f) => f.code === code);
    if (i >= 0) {
      lastRemoved = { fav: list.splice(i, 1)[0], index: i };
      save();
      toast('Removed from saved stops', { action: 'bus-fav-undo', actionLabel: 'Undo' });
    } else {
      const info = stopInfo(code);
      list.push({ code, label: '', name: info?.name || '', road: info?.road || '', services: [], show: 'always' });
      save();
      toast('Stop saved. Tap the pencil on it to give it a name.');
    }
    afterFavChange();
  },

  'bus-fav-undo': () => {
    if (!lastRemoved) return;
    state.bus.favorites.splice(lastRemoved.index, 0, lastRemoved.fav);
    lastRemoved = null;
    save();
    afterFavChange();
  },

  'bus-fav-edit': (el) => {
    const fav = state.bus.favorites.find((f) => f.code === el.dataset.code);
    if (fav) openSheet(favSheetHTML(fav), { label: 'Edit stop' });
  },

  'bus-fav-move': (el) => {
    const list = state.bus.favorites;
    const i = list.findIndex((f) => f.code === el.dataset.code);
    const j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    updateSheet(favSheetHTML(list[j]));
    refresh();
  },

  'bus-fav-remove': (el) => {
    if (!armed(el, 'Tap again to remove')) return;
    const list = state.bus.favorites;
    const i = list.findIndex((f) => f.code === el.dataset.code);
    if (i < 0) return;
    lastRemoved = { fav: list.splice(i, 1)[0], index: i };
    save();
    closeSheet();
    refresh();
    toast('Stop removed', { action: 'bus-fav-undo', actionLabel: 'Undo' });
  },

  'bus-nearby': () => {
    mode = 'nearby';
    nearby = { status: 'loading' };
    updateResults();
    if (!('geolocation' in navigator)) {
      nearby = { status: 'error', msg: 'This device can’t share its location.' };
      updateResults();
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await loadStops();
      } catch {
        nearby = { status: 'error', msg: 'Couldn’t load the list of bus stops. Check your connection and try again.' };
        updateResults();
        return;
      }
      const { latitude, longitude } = pos.coords;
      const list = Object.keys(stops)
        .map((code) => ({ code, d: distance(latitude, longitude, stops[code][1], stops[code][0]) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 10);
      nearby = { status: 'ok', list };
      updateResults();
    }, (err) => {
      nearby = {
        status: 'error',
        msg: err.code === 1
          ? 'Homebase isn’t allowed to use your location. Turn it on in Settings > Privacy & Security > Location Services, then try again.'
          : 'Couldn’t find your location. Try again in a moment.',
      };
      updateResults();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  },

  'bus-clear': () => {
    mode = 'search';
    nearby = null;
    updateResults();
  },
};

const runSearch = debounce(() => {
  mode = 'search';
  nearby = null;
  updateResults();
}, 120);

export const inputs = {
  'bus-search': (el) => {
    query = el.value;
    runSearch();
  },
};

export const forms = {
  'bus-fav-save': (form, fd) => {
    const fav = state.bus.favorites.find((f) => f.code === fd.get('code'));
    if (!fav) return;
    fav.label = String(fd.get('label') || '').trim();
    fav.services = String(fd.get('services') || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    fav.show = String(fd.get('show') || 'always');
    save();
    closeSheet();
    refresh();
    toast('Stop updated');
  },
};

export const view = { title: () => 'Bus', render };
