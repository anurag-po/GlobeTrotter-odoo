/**
 * GlobeTrotter — Calendar Module
 */
export const CalendarModule = {
  trips: [
    { name: 'PARIS TRIP', start: new Date(2026, 5, 8), end: new Date(2026, 5, 12), color: 'red' },
    { name: 'NYC GETAWAY', start: new Date(2026, 5, 14), end: new Date(2026, 5, 16), color: 'blue' },
    { name: 'JAPAN ADVENTURE', start: new Date(2026, 5, 16), end: new Date(2026, 5, 20), color: 'green' },
    { name: 'RAJASTHAN TOUR', start: new Date(2026, 5, 22), end: new Date(2026, 5, 28), color: 'orange' },
  ],

  currentMonth: 5, // June 2026
  currentYear: 2026,

  init() {
    const calendarContainer = document.getElementById('calendar');
    if (!calendarContainer) return;

    this.render();

    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.currentMonth--;
        if (this.currentMonth < 0) {
          this.currentMonth = 11;
          this.currentYear--;
        }
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentMonth++;
        if (this.currentMonth > 11) {
          this.currentMonth = 0;
          this.currentYear++;
        }
        this.render();
      });
    }
  },

  render() {
    const titleEl = document.getElementById('cal-title');
    const gridEl = document.getElementById('cal-grid');
    if (!titleEl || !gridEl) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    titleEl.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;

    gridEl.innerHTML = '';
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    dayNames.forEach((d) => {
      const hdr = document.createElement('div');
      hdr.className = 'calendar-grid__header';
      hdr.textContent = d;
      gridEl.appendChild(hdr);
    });

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-grid__cell calendar-grid__cell--empty';
      gridEl.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-grid__cell';

      if (
        day === today.getDate() &&
        this.currentMonth === today.getMonth() &&
        this.currentYear === today.getFullYear()
      ) {
        cell.classList.add('calendar-grid__cell--today');
      }

      const dayNum = document.createElement('div');
      dayNum.className = 'calendar-grid__day';
      dayNum.textContent = day;
      cell.appendChild(dayNum);

      const cellDate = new Date(this.currentYear, this.currentMonth, day);
      this.trips.forEach((trip) => {
        const tripStart = new Date(trip.start);
        const tripEnd = new Date(trip.end);
        tripStart.setHours(0, 0, 0, 0);
        tripEnd.setHours(0, 0, 0, 0);
        cellDate.setHours(0, 0, 0, 0);

        if (cellDate >= tripStart && cellDate <= tripEnd) {
          const evt = document.createElement('span');
          evt.className = `calendar-event calendar-event--${trip.color}`;
          evt.textContent = trip.name;
          cell.appendChild(evt);
        }
      });

      gridEl.appendChild(cell);
    }
  },
};
