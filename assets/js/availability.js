/**
 * Oblivion — Availability calendars
 *
 * Renders two month-view calendars (Red Room, Blue Room),
 * marks booked dates from the Worker API, lets guests select
 * check-in / check-out and opens a prefilled WhatsApp request.
 */

const AVAILABILITY_API = 'https://oblivion-availability.psakic2.workers.dev/availability';

const WHATSAPP_NUMBER = '385989760245';

const ROOMS = [
  { key: 'red',  name: 'Room I — The Roman Red',  short: 'Red Room' },
  { key: 'blue', name: 'Room II — The Paris Blue', short: 'Blue Room' },
];

// ---------- Date utilities ----------

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function isoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a, b) {
  const ms = parseISO(b) - parseISO(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatPretty(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}

// ---------- Booked-date set ----------
// iCal DTEND is exclusive (checkout day is free for next guest).
// We expand each event into a Set of YYYY-MM-DD strings of NIGHTS that are booked.

function expandBookedNights(events) {
  const set = new Set();
  if (!events) return set;
  for (const ev of events) {
    let cur = parseISO(ev.start);
    const end = parseISO(ev.end);
    while (cur < end) {
      set.add(isoDate(cur));
      cur = addDays(cur, 1);
    }
  }
  return set;
}

function rangeHasBooked(startIso, endIso, bookedSet) {
  // start inclusive, end exclusive (checkout is free)
  let cur = parseISO(startIso);
  const end = parseISO(endIso);
  while (cur < end) {
    if (bookedSet.has(isoDate(cur))) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

// ---------- State per room ----------

const state = {
  red:  { booked: new Set(), monthOffset: 0, checkIn: null, checkOut: null },
  blue: { booked: new Set(), monthOffset: 0, checkIn: null, checkOut: null },
};

// ---------- Rendering ----------

function buildCalendar(roomKey) {
  const s = state[roomKey];
  const today = startOfDay(new Date());
  const view = new Date(today.getFullYear(), today.getMonth() + s.monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();

  // First weekday of the month, treating Monday as start of week.
  // getDay() returns 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const html = [];
  html.push(`<div class="cal-head">`);
  html.push(`  <button type="button" class="cal-nav" data-dir="-1" data-room="${roomKey}" aria-label="Previous month">‹</button>`);
  html.push(`  <div class="cal-title">${MONTH_NAMES[month]} ${year}</div>`);
  html.push(`  <button type="button" class="cal-nav" data-dir="1" data-room="${roomKey}" aria-label="Next month">›</button>`);
  html.push(`</div>`);

  html.push(`<div class="cal-grid cal-dow">`);
  for (const d of DAY_NAMES) html.push(`<div class="cal-dow-cell">${d}</div>`);
  html.push(`</div>`);

  html.push(`<div class="cal-grid cal-days">`);
  for (let i = 0; i < firstDow; i++) html.push(`<div class="cal-cell cal-blank"></div>`);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = isoDate(date);
    const isPast = date < today;
    const isBooked = s.booked.has(iso);
    const isCheckIn  = s.checkIn === iso;
    const isCheckOut = s.checkOut === iso;
    const isInRange = s.checkIn && s.checkOut &&
                      iso > s.checkIn && iso < s.checkOut;

    const classes = ['cal-cell'];
    if (isPast) classes.push('is-past');
    else if (isBooked) classes.push('is-booked');
    else classes.push('is-available');
    if (isCheckIn) classes.push('is-checkin');
    if (isCheckOut) classes.push('is-checkout');
    if (isInRange) classes.push('is-in-range');

    const interactive = !isPast && !isBooked;
    html.push(
      `<div class="${classes.join(' ')}" ${interactive ? `data-room="${roomKey}" data-iso="${iso}" role="button" tabindex="0"` : ''}>` +
      `<span class="cal-day">${day}</span>` +
      `</div>`
    );
  }
  html.push(`</div>`);

  return html.join('');
}

function buildSummary(roomKey) {
  const s = state[roomKey];
  const room = ROOMS.find(r => r.key === roomKey);

  if (!s.checkIn) {
    return `<div class="cal-summary cal-summary-empty">Click an available date to start.</div>`;
  }

  if (!s.checkOut) {
    return `<div class="cal-summary">
      <span class="cal-summary-label">Check-in:</span> <strong>${formatPretty(s.checkIn)}</strong>
      <span class="cal-summary-hint">Now click your check-out date.</span>
    </div>`;
  }

  const nights = daysBetween(s.checkIn, s.checkOut);
  const text = `Hi Petar, I'd like to request the ${room.short} from ${formatPretty(s.checkIn)} to ${formatPretty(s.checkOut)} (${nights} night${nights===1?'':'s'}).`;
  const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:rooms@oblivionstates.com?subject=${encodeURIComponent('Booking request — ' + room.short)}&body=${encodeURIComponent(text)}`;

  return `<div class="cal-summary">
    <div class="cal-summary-line">
      <strong>${formatPretty(s.checkIn)}</strong>
      <span class="cal-arrow">→</span>
      <strong>${formatPretty(s.checkOut)}</strong>
      <span class="cal-nights">· ${nights} night${nights===1?'':'s'}</span>
    </div>
    <div class="cal-actions">
      <a href="${wa}" target="_blank" rel="noopener" class="btn">Request via WhatsApp</a>
      <a href="${mail}" class="btn btn-ghost">Email Instead</a>
      <button type="button" class="cal-clear" data-room="${roomKey}">Clear</button>
    </div>
  </div>`;
}

function render(roomKey) {
  const wrap = document.querySelector(`.cal-wrap[data-room="${roomKey}"]`);
  if (!wrap) return;
  wrap.querySelector('.cal-body').innerHTML = buildCalendar(roomKey);
  wrap.querySelector('.cal-summary-slot').innerHTML = buildSummary(roomKey);
}

// ---------- Event handling ----------

function handleClick(e) {
  // Month navigation
  const navBtn = e.target.closest('.cal-nav');
  if (navBtn) {
    const room = navBtn.dataset.room;
    const dir = parseInt(navBtn.dataset.dir, 10);
    state[room].monthOffset = Math.max(0, state[room].monthOffset + dir);
    render(room);
    return;
  }

  // Clear selection
  const clearBtn = e.target.closest('.cal-clear');
  if (clearBtn) {
    const room = clearBtn.dataset.room;
    state[room].checkIn = null;
    state[room].checkOut = null;
    render(room);
    return;
  }

  // Date click
  const cell = e.target.closest('.cal-cell[data-iso]');
  if (cell) {
    const room = cell.dataset.room;
    const iso = cell.dataset.iso;
    const s = state[room];

    // Choosing check-in (or restarting)
    if (!s.checkIn || s.checkOut || iso <= s.checkIn) {
      s.checkIn = iso;
      s.checkOut = null;
      render(room);
      return;
    }

    // Choosing check-out — must be after check-in and have no booked nights between
    if (iso > s.checkIn) {
      if (rangeHasBooked(s.checkIn, iso, s.booked)) {
        // Range crosses a booked night — restart from this date instead
        s.checkIn = iso;
        s.checkOut = null;
      } else {
        s.checkOut = iso;
      }
      render(room);
      return;
    }
  }
}

function handleKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const cell = e.target.closest('.cal-cell[data-iso]');
  if (cell) {
    e.preventDefault();
    cell.click();
  }
}

// ---------- Boot ----------

async function loadAvailability() {
  if (!AVAILABILITY_API.startsWith('https://') || AVAILABILITY_API.includes('YOUR-WORKER-URL')) {
    // Worker URL not set yet — show a friendly notice and treat all dates as available
    const note = document.querySelector('.cal-status');
    if (note) {
      note.textContent = 'Live availability not yet connected — please WhatsApp us to confirm dates.';
      note.classList.add('cal-status-warn');
    }
    return;
  }

  try {
    const res = await fetch(AVAILABILITY_API, { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.red.booked  = expandBookedNights(data.red);
    state.blue.booked = expandBookedNights(data.blue);
    for (const room of ROOMS) render(room.key);
    const note = document.querySelector('.cal-status');
    if (note && data.updated) {
      const updated = new Date(data.updated);
      note.textContent = `Live · synced ${updated.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }
  } catch (err) {
    console.warn('Availability fetch failed:', err);
    const note = document.querySelector('.cal-status');
    if (note) {
      note.textContent = 'Could not load live availability — please WhatsApp us to confirm dates.';
      note.classList.add('cal-status-warn');
    }
  }
}

function init() {
  const root = document.getElementById('availability');
  if (!root) return;
  for (const room of ROOMS) render(room.key);
  root.addEventListener('click', handleClick);
  root.addEventListener('keydown', handleKey);
  loadAvailability();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
