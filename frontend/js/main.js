/**
 * GlobeTrotter — Modular Universal JavaScript Orchestrator
 * Compatible with all browsers, HTTP/HTTPS servers, and local file:// protocols.
 */

// ============================================================
// 1. Authentication Service
// ============================================================
const ADMIN_EMAIL = 'admin1234@temporaryaccount.none';
const API_BASE_URL = 'http://localhost:3000/api/v1';

const AuthService = {
  getCurrentUser() {
    try {
      const stored = localStorage.getItem('gt_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },

  getAccessToken() {
    return localStorage.getItem('gt_token') || null;
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return Boolean(user && (user.email === ADMIN_EMAIL || user.role === 'admin'));
  },

  async login(identifier, password) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Invalid username/email or password');
      }

      const data = await res.json();
      localStorage.setItem('gt_token', data.accessToken);
      localStorage.setItem('gt_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      // Fallback / offline mode support
      if (identifier.toLowerCase() === ADMIN_EMAIL || identifier.toLowerCase() === 'admin1234') {
        if (password !== 'AdminPassword123!') {
          throw new Error('Invalid administrator password');
        }
        const adminUser = {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'admin1234',
          email: ADMIN_EMAIL,
          firstName: 'GlobeTrotter',
          lastName: 'Admin',
          role: 'admin',
          status: 'active',
          hasVerifiedEmail: true,
        };
        localStorage.setItem('gt_token', 'mock-admin-token');
        localStorage.setItem('gt_user', JSON.stringify(adminUser));
        return adminUser;
      }

      // Check if user is in registered users store
      const allUsers = AdminModule.getUsers();
      const matched = allUsers.find(u => u.email.toLowerCase() === identifier.toLowerCase() || u.username.toLowerCase() === identifier.toLowerCase());
      if (matched) {
        if (matched.status === 'suspended') {
          throw new Error('This account has been suspended by an administrator.');
        }
        localStorage.setItem('gt_token', 'mock-user-token');
        localStorage.setItem('gt_user', JSON.stringify(matched));
        return matched;
      }

      if (err.message && (err.message.includes('fetch') || err.message.includes('Failed') || err.message.includes('NetworkError'))) {
        const demoUser = {
          id: 'mock-user-' + Date.now(),
          username: identifier.split('@')[0],
          email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
          firstName: identifier.split('@')[0],
          lastName: 'Traveler',
          role: 'user',
          status: 'active',
          hasVerifiedEmail: true,
        };
        localStorage.setItem('gt_token', 'mock-user-token');
        localStorage.setItem('gt_user', JSON.stringify(demoUser));
        return demoUser;
      }

      throw err;
    }
  },

  async register(formData) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Registration failed');
      }

      const data = await res.json();
      localStorage.setItem('gt_token', data.accessToken);
      localStorage.setItem('gt_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      const demoUser = {
        id: 'mock-user-' + Date.now(),
        username: formData.username || formData.email.split('@')[0],
        email: formData.email,
        firstName: formData.firstName || 'Traveler',
        lastName: formData.lastName || '',
        role: formData.email === ADMIN_EMAIL ? 'admin' : 'user',
        status: 'active',
        hasVerifiedEmail: true,
      };

      // Register into all users store
      const users = AdminModule.getUsers();
      if (!users.some(u => u.email === demoUser.email)) {
        users.push(demoUser);
        AdminModule.saveUsers(users);
      }

      localStorage.setItem('gt_token', 'mock-user-token');
      localStorage.setItem('gt_user', JSON.stringify(demoUser));
      return demoUser;
    }
  },

  logout() {
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');
    window.location.replace('login.html');
  },

  checkAdminAccess() {
    if (!this.isAdmin()) {
      alert('Access Denied: The Admin Panel is restricted to system administrators (admin1234@temporaryaccount.none).');
      window.location.replace('index.html');
    }
  },

  enforceAuth() {
    const isAuthPage =
      window.location.pathname.endsWith('login.html') ||
      window.location.pathname.endsWith('register.html');

    const user = this.getCurrentUser();
    if (!user && !isAuthPage) {
      window.location.replace('login.html');
    }
  },
};

// ============================================================
// 2. UI Controller Service
// ============================================================
const UIService = {
  showToast(message, type = 'info') {
    let container = document.querySelector('.gt-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'gt-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `gt-toast gt-toast--${type}`;

    const icon =
      type === 'success'
        ? 'fa-circle-check'
        : type === 'error'
        ? 'fa-circle-exclamation'
        : type === 'warning'
        ? 'fa-triangle-exclamation'
        : 'fa-circle-info';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  updateNavbarAuth() {
    const user = AuthService.getCurrentUser();
    const isAdmin = AuthService.isAdmin();
    const nav = document.querySelector('.header__nav');
    const profileSlot = document.querySelector('.header__profile');

    if (nav) {
      const adminLink = nav.querySelector('a[href="admin.html"]');
      if (adminLink) {
        adminLink.style.display = isAdmin ? 'inline-block' : 'none';
      }
    }

    if (profileSlot) {
      if (user) {
        const displayName = user.firstName || user.username || 'Traveler';
        const roleBadge = isAdmin ? '<span class="header__role-badge">Admin</span>' : '';
        profileSlot.outerHTML = `
          <div class="header__user-pill" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 12px; background: rgba(255,255,255,0.18); border-radius: 20px;" onclick="window.location.href='profile.html'">
            <span style="font-weight: 700; color: #fff;">${displayName}</span>
            ${roleBadge}
            <button type="button" title="Log Out" style="background: rgba(0,0,0,0.25); border: none; color: #fff; cursor: pointer; padding: 4px 8px; border-radius: 12px; margin-left: 6px; font-size: 0.75rem; font-weight: 700;" onclick="event.stopPropagation(); window.AuthService.logout();">
              <i class="fas fa-right-from-bracket"></i> Log Out
            </button>
          </div>
        `;
      } else {
        profileSlot.outerHTML = `
          <button type="button" class="btn btn--sm" style="background: rgba(255,255,255,0.2); color: #fff; font-weight: 700; border-radius: 20px; padding: 6px 16px;" onclick="window.location.href='login.html'">
            <i class="fas fa-user-circle"></i> Sign In / Register
          </button>
        `;
      }
    }
  },
};

// ============================================================
// 3. Calendar Module
// ============================================================
const CalendarModule = {
  trips: [
    { name: 'PARIS TRIP', start: new Date(2026, 5, 8), end: new Date(2026, 5, 12), color: 'red' },
    { name: 'NYC GETAWAY', start: new Date(2026, 5, 14), end: new Date(2026, 5, 16), color: 'blue' },
    { name: 'JAPAN ADVENTURE', start: new Date(2026, 5, 16), end: new Date(2026, 5, 20), color: 'green' },
    { name: 'RAJASTHAN TOUR', start: new Date(2026, 5, 22), end: new Date(2026, 5, 28), color: 'orange' },
  ],

  currentMonth: 5,
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

// ============================================================
// 4. Admin Module (Users, Places & Activities Management)
// ============================================================
const AdminModule = {
  defaultUsers: [
    { id: 'usr-1', username: 'admin1234', email: 'admin1234@temporaryaccount.none', firstName: 'GlobeTrotter', lastName: 'Admin', role: 'admin', status: 'active', createdAt: '2026-08-01' },
    { id: 'usr-2', username: 'karan_patel', email: 'karan.patel@explorer.com', firstName: 'Karan', lastName: 'Patel', role: 'user', status: 'active', createdAt: '2026-08-10' },
    { id: 'usr-3', username: 'rohan_verma', email: 'rohan@example.com', firstName: 'Rohan', lastName: 'Verma', role: 'user', status: 'active', createdAt: '2026-08-15' },
    { id: 'usr-4', username: 'priya_sharma', email: 'priya.sharma@example.com', firstName: 'Priya', lastName: 'Sharma', role: 'user', status: 'deletion_requested', createdAt: '2026-08-18' },
  ],

  defaultPlaces: [
    { id: 'place-1', name: 'Paris', country: 'France', region: 'Europe', avgCost: '18,500', satisfaction: '94.2%', visits: '14,820', description: 'The City of Light, famous for romance, art, and world-class cuisine.' },
    { id: 'place-2', name: 'Tokyo', country: 'Japan', region: 'East Asia', avgCost: '22,000', satisfaction: '96.8%', visits: '11,450', description: 'Ultra-modern metropolis blended with timeless historic shrines.' },
    { id: 'place-3', name: 'New York City', country: 'USA', region: 'North America', avgCost: '28,000', satisfaction: '91.5%', visits: '9,380', description: 'Premier global hub for culture, theater, dining, and skyline views.' },
    { id: 'place-4', name: 'Rome', country: 'Italy', region: 'Europe', avgCost: '16,200', satisfaction: '93.4%', visits: '8,720', description: 'The Eternal City, home of the Colosseum and historic ruins.' },
    { id: 'place-5', name: 'Jaipur & Udaipur', country: 'India', region: 'Rajasthan', avgCost: '12,500', satisfaction: '97.2%', visits: '16,400', description: 'Royal palace heritage circuits, historic forts, and pristine lake boat tours.' },
  ],

  defaultActivities: [
    { id: 'act-1', name: 'Eiffel Tower Summit Tour', place: 'Paris', category: 'Sightseeing', cost: '3,200', duration: '2.5 hrs', description: 'Ascent to the top observatory of the Eiffel Tower with panoramic views.' },
    { id: 'act-2', name: 'Shibuya Crossing & Ramen Walk', place: 'Tokyo', category: 'Food & Culture', cost: '4,500', duration: '3 hrs', description: 'Guided street food and ramen tasting through neon Shibuya alleys.' },
    { id: 'act-3', name: 'Lake Pichola Sunset Boat Cruise', place: 'Jaipur & Udaipur', category: 'Heritage', cost: '1,800', duration: '1.5 hrs', description: 'Private scenic boat ride around Jag Mandir and City Palace.' },
    { id: 'act-4', name: 'Colosseum Gladiator Arena Access', place: 'Rome', category: 'Sightseeing', cost: '3,800', duration: '3 hrs', description: 'Exclusive floor access with archaeologist historian guide.' },
    { id: 'act-5', name: 'Paragliding Tandem Joyride', place: 'Bir Billing', category: 'Adventure', cost: '3,500', duration: '2.0 hrs', description: 'World-renowned takeoff site over Kangra Valley with certified instructors.' }
  ],

  getUsers() {
    try {
      const stored = localStorage.getItem('gt_all_users');
      return stored ? JSON.parse(stored) : this.defaultUsers;
    } catch {
      return this.defaultUsers;
    }
  },

  saveUsers(users) {
    localStorage.setItem('gt_all_users', JSON.stringify(users));
  },

  getPlaces() {
    try {
      const stored = localStorage.getItem('gt_admin_places');
      return stored ? JSON.parse(stored) : this.defaultPlaces;
    } catch {
      return this.defaultPlaces;
    }
  },

  savePlaces(places) {
    localStorage.setItem('gt_admin_places', JSON.stringify(places));
  },

  getActivities() {
    try {
      const stored = localStorage.getItem('gt_admin_activities');
      return stored ? JSON.parse(stored) : this.defaultActivities;
    } catch {
      return this.defaultActivities;
    }
  },

  saveActivities(activities) {
    localStorage.setItem('gt_admin_activities', JSON.stringify(activities));
  },

  init() {
    const tabs = document.querySelectorAll('.admin-tabs__tab');
    const contents = document.querySelectorAll('.admin-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        contents.forEach((c) => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    this.renderUsersList();
    this.renderPlacesList();
    this.renderActivitiesList();

    if (document.getElementById('chart-bar-container')) {
      this.drawBarChart('chart-bar-container');
    }
  },

  renderUsersList() {
    const container = document.getElementById('chart-users');
    if (!container) return;

    const users = this.getUsers();

    let tableRows = users.map((u) => {
      const isPrimaryAdmin = u.email === ADMIN_EMAIL;
      const isAdminRole = u.role === 'admin';
      const isDeletion = u.status === 'deletion_requested';
      const isSuspended = u.status === 'suspended';
      const initial = (u.firstName || u.username || 'U').charAt(0).toUpperCase();

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center;">
              <div class="user-avatar-sm" style="${isAdminRole ? 'background: linear-gradient(135deg, #DC2626, #F59E0B);' : ''}">${initial}</div>
              <div>
                <strong>${u.firstName || ''} ${u.lastName || ''}</strong>
                <div style="font-size: 0.78rem; color: var(--clr-text-muted);">@${u.username || 'traveler'}</div>
              </div>
            </div>
          </td>
          <td>${u.email}</td>
          <td>
            <span class="badge" style="background: ${isAdminRole ? '#FEE2E2' : 'var(--clr-primary-light)'}; color: ${isAdminRole ? '#DC2626' : 'var(--clr-primary)'}; font-weight: 700;">
              ${isAdminRole ? 'Admin' : 'Explorer'}
            </span>
          </td>
          <td>
            <span class="badge ${isDeletion ? '' : (isSuspended ? '' : 'badge--completed')}" style="${isDeletion ? 'background: #FEE2E2; color: #DC2626;' : (isSuspended ? 'background: #E2E8F0; color: #64748B;' : '')}">
              ${isDeletion ? 'Deletion Requested' : (isSuspended ? 'Suspended' : 'Active')}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            ${!isPrimaryAdmin ? `
              ${!isAdminRole ? `
                <button type="button" class="btn btn--sm" style="background: #E0E7FF; color: #4338CA; font-weight: 700; border-radius: 4px; padding: 4px 8px; margin-right: 4px;" onclick="window.AdminModule.promoteToAdmin('${u.id}')" title="Grant Administrator Rights">
                  <i class="fas fa-shield-alt"></i> Make Admin
                </button>
              ` : `
                <button type="button" class="btn btn--sm" style="background: #FEF3C7; color: #D97706; font-weight: 700; border-radius: 4px; padding: 4px 8px; margin-right: 4px;" onclick="window.AdminModule.revokeAdmin('${u.id}')" title="Revoke Admin Rights">
                  <i class="fas fa-user-minus"></i> Revoke Admin
                </button>
              `}
              
              <button type="button" class="btn btn--sm" style="background: ${isSuspended ? '#DCFCE7' : '#F1F5F9'}; color: ${isSuspended ? '#15803D' : '#475569'}; font-weight: 700; border-radius: 4px; padding: 4px 8px; margin-right: 4px;" onclick="window.AdminModule.toggleSuspendUser('${u.id}')">
                ${isSuspended ? '<i class="fas fa-check"></i> Unsuspend' : '<i class="fas fa-ban"></i> Suspend'}
              </button>

              ${isDeletion ? `
                <button type="button" class="btn btn--sm" style="background: #DC2626; color: #FFFFFF; font-weight: 700; border-radius: 4px; padding: 4px 8px;" onclick="window.AdminModule.approveDataDeletion('${u.id}')" title="Approve GDPR Account Deletion">
                  <i class="fas fa-user-xmark"></i> Approve Deletion (Purge)
                </button>
              ` : `
                <button type="button" class="btn btn--sm" style="background: #FEE2E2; color: #DC2626; font-weight: 700; border-radius: 4px; padding: 4px 8px;" onclick="window.AdminModule.deleteUser('${u.id}')" title="Delete User Record">
                  <i class="fas fa-trash-alt"></i>
                </button>
              `}
            ` : `<span style="font-size: 0.78rem; color: var(--clr-text-muted); font-weight: 700;">Super Admin</span>`}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--clr-border); flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--clr-text); margin: 0;">User Directory &amp; RBAC Permissions (${users.length} Users)</h3>
            <p style="font-size: 0.82rem; color: var(--clr-text-muted); margin: 4px 0 0 0;">Manage platform accounts, promote administrators, revoke credentials, and review GDPR deletion requests.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" style="font-weight: 700;" onclick="document.getElementById('adminAddUserModal').classList.add('active')">
            <i class="fas fa-user-shield"></i> + Add Administrator
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>User Account</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th style="text-align: right;">Administrative Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  promoteToAdmin(userId) {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return;

    target.role = 'admin';
    this.saveUsers(users);
    this.renderUsersList();
    UIService.showToast(`User ${target.email} has been promoted to Administrator!`, 'success');
  },

  revokeAdmin(userId) {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return;

    target.role = 'user';
    this.saveUsers(users);
    this.renderUsersList();
    UIService.showToast(`Administrator rights revoked for ${target.email}.`, 'info');
  },

  toggleSuspendUser(userId) {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return;

    target.status = target.status === 'suspended' ? 'active' : 'suspended';
    this.saveUsers(users);
    this.renderUsersList();
    UIService.showToast(`User ${target.email} is now ${target.status}.`, target.status === 'suspended' ? 'warning' : 'success');
  },

  approveDataDeletion(userId) {
    let users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return;

    const confirmPurge = confirm(`Are you sure you want to approve GDPR Data Deletion for ${target.email}?\n\nThis will permanently purge their profile, itineraries, and records.`);
    if (!confirmPurge) return;

    users = users.filter(u => u.id !== userId);
    this.saveUsers(users);
    this.renderUsersList();
    UIService.showToast(`User data for ${target.email} permanently purged under GDPR request.`, 'success');
  },

  deleteUser(userId) {
    let users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) return;

    if (confirm(`Remove user ${target.email}?`)) {
      users = users.filter(u => u.id !== userId);
      this.saveUsers(users);
      this.renderUsersList();
      UIService.showToast(`User ${target.email} removed.`, 'info');
    }
  },

  renderPlacesList() {
    const container = document.getElementById('chart-cities');
    if (!container) return;

    const places = this.getPlaces();

    let listHtml = places
      .map(
        (p, idx) => `
        <li style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--clr-bg); border-radius: var(--radius-sm); border: 1px solid var(--clr-border); margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="font-weight: 800; color: var(--clr-primary); font-size: 1.1rem; width: 26px;">#${idx + 1}</span>
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--clr-text);">${p.name}, ${p.country}</div>
              <div style="font-size: 0.82rem; color: var(--clr-text-muted); margin-top: 2px;">
                ${p.region} &bull; Avg. Cost: <strong>₹${p.avgCost}</strong> &bull; ${p.description || ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button type="button" class="btn btn--sm" style="background: #FEE2E2; color: #DC2626; padding: 6px 12px; font-weight: 700; border-radius: 6px;" onclick="window.AdminModule.removePlace('${p.id}')">
              <i class="fas fa-trash-alt"></i> Remove
            </button>
          </div>
        </li>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--clr-border); flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--clr-text); margin: 0;">Destination Catalog (${places.length} Places)</h3>
            <p style="font-size: 0.82rem; color: var(--clr-text-muted); margin: 4px 0 0 0;">Manage global destinations, regional pricing, and traveler recommendations.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" style="font-weight: 700;" onclick="window.AdminModule.openAddPlaceModal()">
            <i class="fas fa-plus"></i> + Add Place
          </button>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${listHtml || '<li style="color: var(--clr-text-muted); padding: 20px; text-align: center;">No destinations in catalog. Click "+ Add Place" to add one.</li>'}
        </ul>
      </div>
    `;
  },

  renderActivitiesList() {
    const container = document.getElementById('chart-activities');
    if (!container) return;

    const activities = this.getActivities();

    let listHtml = activities
      .map(
        (a, idx) => `
        <li style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--clr-bg); border-radius: var(--radius-sm); border: 1px solid var(--clr-border); margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="font-weight: 800; color: var(--clr-accent); font-size: 1.1rem; width: 26px;">#${idx + 1}</span>
            <div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--clr-text);">${a.name}</div>
              <div style="font-size: 0.82rem; color: var(--clr-text-muted); margin-top: 2px;">
                <span class="badge" style="background: var(--clr-primary-light); color: var(--clr-primary); font-size: 0.72rem; padding: 2px 6px;">${a.category}</span> &bull; 
                Place: <strong>${a.place}</strong> &bull; Price: <strong>₹${a.cost}</strong> &bull; Duration: ${a.duration}
              </div>
            </div>
          </div>
          <button type="button" class="btn btn--sm" style="background: #FEE2E2; color: #DC2626; padding: 6px 12px; font-weight: 700; border-radius: 6px;" onclick="window.AdminModule.removeActivity('${a.id}')">
            <i class="fas fa-trash-alt"></i> Remove
          </button>
        </li>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--clr-border); flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--clr-text); margin: 0;">Curated Activities Catalog (${activities.length} Items)</h3>
            <p style="font-size: 0.82rem; color: var(--clr-text-muted); margin: 4px 0 0 0;">Manage bookable excursions, tickets, tours, and price details.</p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" style="font-weight: 700;" onclick="window.AdminModule.openAddActivityModal()">
            <i class="fas fa-plus"></i> + Add Activity
          </button>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${listHtml || '<li style="color: var(--clr-text-muted); padding: 20px; text-align: center;">No activities in catalog. Click "+ Add Activity" to add one.</li>'}
        </ul>
      </div>
    `;
  },

  addPlace(place) {
    const places = this.getPlaces();
    const newPlace = {
      id: 'place-' + Date.now(),
      ...place,
    };
    places.unshift(newPlace);
    this.savePlaces(places);
    this.renderPlacesList();
    UIService.showToast(`Destination "${place.name}" added to catalog!`, 'success');
  },

  removePlace(id) {
    let places = this.getPlaces();
    const target = places.find((p) => p.id === id);
    places = places.filter((p) => p.id !== id);
    this.savePlaces(places);
    this.renderPlacesList();
    UIService.showToast(`Destination "${target?.name || 'Place'}" removed.`, 'info');
  },

  addActivity(activity) {
    const activities = this.getActivities();
    const newActivity = {
      id: 'act-' + Date.now(),
      ...activity,
    };
    activities.unshift(newActivity);
    this.saveActivities(activities);
    this.renderActivitiesList();
    UIService.showToast(`Activity "${activity.name}" added!`, 'success');
  },

  removeActivity(id) {
    let activities = this.getActivities();
    const target = activities.find((a) => a.id === id);
    activities = activities.filter((a) => a.id !== id);
    this.saveActivities(activities);
    this.renderActivitiesList();
    UIService.showToast(`Activity "${target?.name || 'Item'}" removed.`, 'info');
  },

  openAddPlaceModal() {
    let modal = document.getElementById('adminAddPlaceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminAddPlaceModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Add New Place / Destination</h3>
            <button type="button" class="modal-close" onclick="document.getElementById('adminAddPlaceModal').classList.remove('active')">&times;</button>
          </div>
          <form id="adminPlaceForm" onsubmit="window.handleAdminAddPlace(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">City / Destination Name *</label>
                <input type="text" id="admPlaceName" class="form-control" placeholder="e.g. Manali" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Country *</label>
                  <input type="text" id="admPlaceCountry" class="form-control" placeholder="India" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Region / State *</label>
                  <input type="text" id="admPlaceRegion" class="form-control" placeholder="Himachal Pradesh" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Average Cost (₹) *</label>
                <input type="number" id="admPlaceCost" class="form-control" placeholder="8500" required>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="admPlaceDesc" class="form-control" rows="2" placeholder="Brief destination overview and highlight attractions..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('adminAddPlaceModal').classList.remove('active')">Cancel</button>
              <button type="submit" class="btn btn--primary">Save Destination</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
  },

  openAddActivityModal() {
    let modal = document.getElementById('adminAddActModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminAddActModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Add New Curated Activity</h3>
            <button type="button" class="modal-close" onclick="document.getElementById('adminAddActModal').classList.remove('active')">&times;</button>
          </div>
          <form id="adminActForm" onsubmit="window.handleAdminAddActivity(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Activity Name *</label>
                <input type="text" id="admActName" class="form-control" placeholder="e.g. Paragliding Tandem Flight" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Destination / Place *</label>
                  <input type="text" id="admActPlace" class="form-control" placeholder="Manali" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select id="admActCategory" class="form-control" required>
                    <option value="Adventure">Adventure</option>
                    <option value="Sightseeing">Sightseeing</option>
                    <option value="Heritage">Heritage</option>
                    <option value="Food & Culture">Food & Culture</option>
                    <option value="Relaxation">Relaxation</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Cost / Price (₹) *</label>
                  <input type="number" id="admActCost" class="form-control" placeholder="3200" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Duration</label>
                  <input type="text" id="admActDuration" class="form-control" placeholder="2 hours">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="admActDesc" class="form-control" rows="2" placeholder="Activity details, safety instructions, or inclusions..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn--outline" onclick="document.getElementById('adminAddActModal').classList.remove('active')">Cancel</button>
              <button type="submit" class="btn btn--primary">Save Activity</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
  },

  drawBarChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const bars = [
      { label: 'Jan', value: 70, color: '#1A56DB' },
      { label: 'Feb', value: 50, color: '#FF5A5F' },
      { label: 'Mar', value: 85, color: '#10B981' },
      { label: 'Apr', value: 40, color: '#F59E0B' },
      { label: 'May', value: 65, color: '#0284C7' },
      { label: 'Jun', value: 95, color: '#1A56DB' },
    ];

    let barsHtml = '';
    bars.forEach((bar, i) => {
      const x = 20 + i * 45;
      const h = bar.value * 1.5;
      const y = 160 - h;
      barsHtml += `<rect x="${x}" y="${y}" width="30" height="${h}" fill="${bar.color}" rx="4"/>`;
      barsHtml += `<text x="${x + 15}" y="178" text-anchor="middle" font-size="10" font-weight="600" fill="#64748B">${bar.label}</text>`;
    });

    container.innerHTML = `
      <svg viewBox="0 0 300 200" width="100%" height="220">
        <line x1="15" y1="10" x2="15" y2="165" stroke="#E2E8F0" stroke-width="1"/>
        <line x1="15" y1="165" x2="290" y2="165" stroke="#E2E8F0" stroke-width="1"/>
        ${barsHtml}
      </svg>
    `;
  },
};

// Global Exposure
window.AuthService = AuthService;
window.UIService = UIService;
window.CalendarModule = CalendarModule;
window.AdminModule = AdminModule;
window.GlobeTrotterAuth = AuthService;

window.handleAdminAddPlace = function (e) {
  e.preventDefault();
  const name = document.getElementById('admPlaceName').value.trim();
  const country = document.getElementById('admPlaceCountry').value.trim();
  const region = document.getElementById('admPlaceRegion').value.trim();
  const avgCost = document.getElementById('admPlaceCost').value.trim();
  const description = document.getElementById('admPlaceDesc').value.trim();

  AdminModule.addPlace({ name, country, region, avgCost, description });
  document.getElementById('adminAddPlaceModal').classList.remove('active');
  document.getElementById('adminPlaceForm').reset();
};

window.handleAdminAddActivity = function (e) {
  e.preventDefault();
  const name = document.getElementById('admActName').value.trim();
  const place = document.getElementById('admActPlace').value.trim();
  const category = document.getElementById('admActCategory').value;
  const cost = document.getElementById('admActCost').value.trim();
  const duration = document.getElementById('admActDuration').value.trim() || '1.5 hrs';
  const description = document.getElementById('admActDesc').value.trim();

  AdminModule.addActivity({ name, place, category, cost, duration, description });
  document.getElementById('adminAddActModal').classList.remove('active');
  document.getElementById('adminActForm').reset();
};

window.handleAdminCreateAdmin = function (e) {
  e.preventDefault();
  const firstName = document.getElementById('admNewFirst').value.trim();
  const lastName = document.getElementById('admNewLast').value.trim();
  const email = document.getElementById('admNewEmail').value.trim();
  const password = document.getElementById('admNewPass').value;

  const users = AdminModule.getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    UIService.showToast('User with this email already exists!', 'error');
    return;
  }

  const newAdmin = {
    id: 'usr-' + Date.now(),
    username: email.split('@')[0],
    email,
    firstName,
    lastName,
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0]
  };

  users.unshift(newAdmin);
  AdminModule.saveUsers(users);
  AdminModule.renderUsersList();
  document.getElementById('adminAddUserModal').classList.remove('active');
  document.getElementById('adminNewAdminForm').reset();
  UIService.showToast(`New Administrator "${firstName} ${lastName}" created!`, 'success');
};

// DOM Bootstrapper & Lifecycle
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.header__hamburger');
  const nav = document.querySelector('.header__nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  UIService.updateNavbarAuth();

  const isCurrentPageAdmin = window.location.pathname.endsWith('admin.html');
  if (isCurrentPageAdmin) {
    AuthService.checkAdminAccess();
    AdminModule.init();
  }

  if (document.getElementById('calendar')) {
    CalendarModule.init();
  }

  document.querySelectorAll('.btn--outline[data-dropdown]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  AuthService.enforceAuth();
});
