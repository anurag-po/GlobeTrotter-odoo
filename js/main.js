/* ============================================================
   GlobalTrotter — Shared JavaScript
   Nav toggle, Admin tabs, Calendar, Filter dropdowns
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile Nav Toggle ---------- */
  const hamburger = document.querySelector('.header__hamburger');
  const nav = document.querySelector('.header__nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  /* ---------- Admin Panel Tab Switching ---------- */
  const tabs = document.querySelectorAll('.admin-tabs__tab');
  const contents = document.querySelectorAll('.admin-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  /* ---------- Calendar Month Navigation ---------- */
  const calendarContainer = document.getElementById('calendar');
  if (calendarContainer) {
    initCalendar();
  }

  /* ---------- Filter / Sort / Group-by Toggles ---------- */
  document.querySelectorAll('.btn--outline[data-dropdown]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });
});

/* ============================================================
   Calendar Logic
   ============================================================ */
const TRIPS = [
  { name: 'PARIS TRIP', start: new Date(2024, 0, 8), end: new Date(0, 0, 12), color: 'red' },
  { name: 'NYC GETAWAY', start: new Date(2024, 0, 14), end: new Date(2024, 0, 16), color: 'blue' },
  { name: 'JAPAN ADVENTURE', start: new Date(2024, 0, 16), end: new Date(2024, 0, 20), color: 'green' },
  { name: 'PARIS 10', start: new Date(2024, 0, 10), end: new Date(2024, 0, 10), color: 'orange' },
  { name: 'NYC GETAWAY', start: new Date(2024, 0, 22), end: new Date(2024, 0, 28), color: 'blue' },
];

let currentMonth = 0; // January
let currentYear = 2024;

function initCalendar() {
  renderCalendar(currentMonth, currentYear);

  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');

  if (prevBtn) prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(currentMonth, currentYear);
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar(currentMonth, currentYear);
  });
}

function renderCalendar(month, year) {
  const titleEl = document.getElementById('cal-title');
  const gridEl = document.getElementById('cal-grid');
  if (!titleEl || !gridEl) return;

  const monthNames = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  titleEl.textContent = `${monthNames[month]} ${year}`;

  // Clear only day cells (keep headers)
  const headers = gridEl.querySelectorAll('.calendar-grid__header');
  gridEl.innerHTML = '';
  const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  dayNames.forEach(d => {
    const hdr = document.createElement('div');
    hdr.className = 'calendar-grid__header';
    hdr.textContent = d;
    gridEl.appendChild(hdr);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-grid__cell calendar-grid__cell--empty';
    gridEl.appendChild(cell);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-grid__cell';

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      cell.classList.add('calendar-grid__cell--today');
    }

    const dayNum = document.createElement('div');
    dayNum.className = 'calendar-grid__day';
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    // Check for trips on this day
    const cellDate = new Date(year, month, day);
    TRIPS.forEach(trip => {
      const tripStart = new Date(trip.start);
      const tripEnd = new Date(trip.end);
      // Normalize dates
      tripStart.setHours(0,0,0,0);
      tripEnd.setHours(0,0,0,0);
      cellDate.setHours(0,0,0,0);

      if (cellDate >= tripStart && cellDate <= tripEnd) {
        const evt = document.createElement('span');
        evt.className = `calendar-event calendar-event--${trip.color}`;
        evt.textContent = trip.name;
        cell.appendChild(evt);
      }
    });

    gridEl.appendChild(cell);
  }
}

/* ============================================================
   Admin Chart Placeholders (SVG-based)
   ============================================================ */
function drawPieChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <svg viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="90" fill="#D84E55" />
      <path d="M100,100 L100,10 A90,90 0 0,1 190,100 Z" fill="#2980B9" />
      <path d="M100,100 L190,100 A90,90 0 0,1 145,185 Z" fill="#27AE60" />
      <path d="M100,100 L145,185 A90,90 0 0,1 55,185 Z" fill="#F39C12" />
      <circle cx="100" cy="100" r="40" fill="white" />
      <text x="100" y="105" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">Trips</text>
    </svg>
  `;
}

function drawBarChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const bars = [
    { label: 'Jan', value: 70, color: '#D84E55' },
    { label: 'Feb', value: 50, color: '#2980B9' },
    { label: 'Mar', value: 85, color: '#27AE60' },
    { label: 'Apr', value: 40, color: '#F39C12' },
    { label: 'May', value: 65, color: '#D84E55' },
    { label: 'Jun', value: 90, color: '#2980B9' },
  ];

  let barsHtml = '';
  bars.forEach((bar, i) => {
    const x = 20 + i * 45;
    const h = bar.value * 1.5;
    const y = 160 - h;
    barsHtml += `<rect x="${x}" y="${y}" width="30" height="${h}" fill="${bar.color}" rx="3"/>`;
    barsHtml += `<text x="${x + 15}" y="178" text-anchor="middle" font-size="10" fill="#888">${bar.label}</text>`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 300 200" width="300" height="200">
      <line x1="15" y1="10" x2="15" y2="165" stroke="#E0E0E0" stroke-width="1"/>
      <line x1="15" y1="165" x2="290" y2="165" stroke="#E0E0E0" stroke-width="1"/>
      ${barsHtml}
    </svg>
  `;
}
