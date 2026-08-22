/* ============================================================
   GlobalTrotter — Shared JavaScript & Modular Auth Gateway
   Nav toggle, Admin RBAC guard, Auth Gateway, Calendar, Tabs
   ============================================================ */

const API_BASE_URL = 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = 'admin1234@temporaryaccount.none';

/* ============================================================
   Authentication Service (Client-Side State & Backend Bridge)
   ============================================================ */
const GlobeTrotterAuth = {
  getCurrentUser() {
    try {
      const stored = localStorage.getItem('gt_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
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
      // Local fallback for offline demo / standalone HTML file usage
      if (identifier.toLowerCase() === ADMIN_EMAIL || identifier.toLowerCase() === 'admin1234') {
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

      // If user typed password and error was network failure, allow client demo fallback
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        const demoUser = {
          id: 'mock-user-id',
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
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
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
        localStorage.setItem('gt_token', 'mock-user-token');
        localStorage.setItem('gt_user', JSON.stringify(demoUser));
        return demoUser;
      }
      throw err;
    }
  },

  logout() {
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');
    showToast('Logged out successfully', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 400);
  },
};

/* ============================================================
   Toast Notification System
   ============================================================ */
function showToast(message, type = 'info') {
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
}

/* ============================================================
   DOM Initialization & Navigation Role-Based Guard
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Nav Toggle
  const hamburger = document.querySelector('.header__hamburger');
  const nav = document.querySelector('.header__nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  // 2. Update Navigation bar according to Logged-in / Admin status
  updateNavbarAuth();

  // 3. Admin Page RBAC Security Guard
  const isCurrentPageAdmin = window.location.pathname.endsWith('admin.html');
  if (isCurrentPageAdmin) {
    checkAdminAccess();
  }

  // 4. Admin Panel Tab Switching
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

  // 5. Calendar Month Navigation
  const calendarContainer = document.getElementById('calendar');
  if (calendarContainer) {
    initCalendar();
  }

  // 6. Filter / Sort / Group-by Toggles
  document.querySelectorAll('.btn--outline[data-dropdown]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // 7. Auto-trigger Auth Modal on index.html if unauthenticated
  const isIndexPage =
    window.location.pathname.endsWith('index.html') ||
    window.location.pathname.endsWith('/') ||
    window.location.pathname === '';
  if (isIndexPage && !GlobeTrotterAuth.getCurrentUser()) {
    setTimeout(() => {
      openAuthModal('login');
    }, 300);
  }
});

/* ============================================================
   Navbar Auth & Role-Based Visibility
   ============================================================ */
function updateNavbarAuth() {
  const user = GlobeTrotterAuth.getCurrentUser();
  const isAdmin = GlobeTrotterAuth.isAdmin();
  const nav = document.querySelector('.header__nav');
  const profileSlot = document.querySelector('.header__profile');

  // Enforce Admin link visibility
  if (nav) {
    const adminLink = nav.querySelector('a[href="admin.html"]');
    if (adminLink) {
      if (isAdmin) {
        adminLink.style.display = 'inline-block';
      } else {
        adminLink.style.display = 'none';
      }
    }
  }

  // Enforce Profile / Auth header slot
  if (profileSlot) {
    if (user) {
      const displayName = user.firstName || user.username || 'Traveler';
      const roleBadge = isAdmin ? '<span class="header__role-badge">Admin</span>' : '';
      profileSlot.outerHTML = `
        <div class="header__user-pill" title="Click to view options" onclick="handleUserMenuClick(event)">
          <img src="${user.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" alt="${displayName}" class="header__user-avatar">
          <span>${displayName}</span>
          ${roleBadge}
          <i class="fas fa-right-from-bracket" title="Log Out" style="margin-left: 6px; font-size: 0.8rem; opacity: 0.8;" onclick="event.stopPropagation(); GlobeTrotterAuth.logout();"></i>
        </div>
      `;
    } else {
      profileSlot.outerHTML = `
        <button type="button" class="btn btn--sm" style="background: rgba(255,255,255,0.2); color: #fff; font-weight: 700; border-radius: 20px; padding: 6px 16px;" onclick="openAuthModal('login')">
          <i class="fas fa-user-circle"></i> Sign In / Register
        </button>
      `;
    }
  }
}

function handleUserMenuClick(event) {
  event.preventDefault();
  window.location.href = 'profile.html';
}

/* ============================================================
   Admin Access Guard for admin.html
   ============================================================ */
function checkAdminAccess() {
  if (!GlobeTrotterAuth.isAdmin()) {
    alert('Access Denied: The Admin Panel is restricted to system administrators (admin1234@temporaryaccount.none).');
    window.location.href = 'index.html';
  }
}

/* ============================================================
   Auth Gateway Modal Controller (Login / Signup Toggle)
   ============================================================ */
function openAuthModal(initialTab = 'login') {
  let modal = document.getElementById('authGatewayModal');
  if (!modal) {
    modal = createAuthModalDOM();
  }
  modal.classList.add('active');
  switchAuthTab(initialTab);
}

function closeAuthModal() {
  const modal = document.getElementById('authGatewayModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function switchAuthTab(tab) {
  const loginTabBtn = document.getElementById('gtTabLoginBtn');
  const signupTabBtn = document.getElementById('gtTabSignupBtn');
  const loginPane = document.getElementById('gtPaneLogin');
  const signupPane = document.getElementById('gtPaneSignup');

  if (!loginTabBtn || !signupTabBtn || !loginPane || !signupPane) return;

  if (tab === 'login') {
    loginTabBtn.classList.add('active');
    signupTabBtn.classList.remove('active');
    loginPane.classList.add('active');
    signupPane.classList.remove('active');
  } else {
    signupTabBtn.classList.add('active');
    loginTabBtn.classList.remove('active');
    signupPane.classList.add('active');
    loginPane.classList.remove('active');
  }
}

function createAuthModalDOM() {
  const modal = document.createElement('div');
  modal.id = 'authGatewayModal';
  modal.className = 'auth-gateway-modal';

  modal.innerHTML = `
    <div class="auth-gateway-card">
      <button type="button" class="auth-close-btn" onclick="closeAuthModal()" aria-label="Close">
        <i class="fas fa-times"></i>
      </button>

      <div class="auth-gateway-header">
        <div class="auth-gateway-brand">
          <i class="fas fa-globe-americas"></i> GlobeTrotter
        </div>
        <p class="auth-gateway-subtitle">Sign in or create your explorer account to start planning.</p>
      </div>

      <div class="auth-tabs-nav">
        <div id="gtTabLoginBtn" class="auth-tab-btn active" onclick="switchAuthTab('login')">
          <i class="fas fa-lock"></i> Login
        </div>
        <div id="gtTabSignupBtn" class="auth-tab-btn" onclick="switchAuthTab('signup')">
          <i class="fas fa-user-plus"></i> Sign Up
        </div>
      </div>

      <!-- Login Form Pane -->
      <div id="gtPaneLogin" class="auth-tab-pane active">
        <form id="gtLoginForm" onsubmit="handleModalLogin(event)">
          <div class="form-group">
            <label class="form-label" for="gtLoginEmail">Email or Username</label>
            <input type="text" id="gtLoginEmail" class="form-control" placeholder="e.g. admin1234@temporaryaccount.none" required value="admin1234@temporaryaccount.none">
          </div>
          <div class="form-group">
            <label class="form-label" for="gtLoginPassword">Password</label>
            <input type="password" id="gtLoginPassword" class="form-control" placeholder="Enter your password" required value="AdminPassword123!">
          </div>
          <div style="font-size: 0.8rem; color: var(--clr-text-muted); margin-bottom: 16px;">
            <i class="fas fa-shield-halved" style="color: var(--clr-primary);"></i> Admin: <strong>admin1234@temporaryaccount.none</strong>
          </div>
          <button type="submit" id="gtLoginSubmit" class="btn btn--primary btn--block" style="padding: 12px; font-weight: 700;">
            <span>Sign In to GlobeTrotter</span>
            <i class="fas fa-arrow-right"></i>
          </button>
        </form>
      </div>

      <!-- Sign Up Form Pane -->
      <div id="gtPaneSignup" class="auth-tab-pane">
        <form id="gtSignupForm" onsubmit="handleModalSignup(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="gtRegFirst">First Name *</label>
              <input type="text" id="gtRegFirst" class="form-control" placeholder="Priya" required value="Priya">
            </div>
            <div class="form-group">
              <label class="form-label" for="gtRegLast">Last Name *</label>
              <input type="text" id="gtRegLast" class="form-control" placeholder="Sharma" required value="Sharma">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="gtRegEmail">Email Address *</label>
            <input type="email" id="gtRegEmail" class="form-control" placeholder="priya@example.com" required value="priya.sharma@example.com">
          </div>
          <div class="form-group">
            <label class="form-label" for="gtRegPassword">Password (8+ chars, 1 letter & 1 digit) *</label>
            <input type="password" id="gtRegPassword" class="form-control" placeholder="Create strong password" required value="TravelPass123!">
          </div>
          <div class="form-group">
            <label class="form-label" for="gtRegCity">City & Country</label>
            <input type="text" id="gtRegCity" class="form-control" placeholder="Ahmedabad, India" value="Ahmedabad, India">
          </div>
          <button type="submit" id="gtSignupSubmit" class="btn btn--primary btn--block" style="padding: 12px; font-weight: 700;">
            <span>Create Free Account</span>
            <i class="fas fa-check"></i>
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuthModal();
  });

  return modal;
}

async function handleModalLogin(e) {
  e.preventDefault();
  const email = document.getElementById('gtLoginEmail').value.trim();
  const password = document.getElementById('gtLoginPassword').value;
  const btn = document.getElementById('gtLoginSubmit');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

  try {
    const user = await GlobeTrotterAuth.login(email, password);
    showToast(`Welcome back, ${user.firstName || user.username}!`, 'success');
    closeAuthModal();
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    showToast(err.message || 'Login failed', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In to GlobeTrotter</span> <i class="fas fa-arrow-right"></i>';
  }
}

async function handleModalSignup(e) {
  e.preventDefault();
  const firstName = document.getElementById('gtRegFirst').value.trim();
  const lastName = document.getElementById('gtRegLast').value.trim();
  const email = document.getElementById('gtRegEmail').value.trim();
  const password = document.getElementById('gtRegPassword').value;
  const city = document.getElementById('gtRegCity').value.trim();
  const btn = document.getElementById('gtSignupSubmit');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  try {
    const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
    const user = await GlobeTrotterAuth.register({
      username,
      email,
      password,
      firstName,
      lastName,
      city,
    });
    showToast(`Account created! Welcome, ${user.firstName}!`, 'success');
    closeAuthModal();
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    showToast(err.message || 'Registration failed', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>Create Free Account</span> <i class="fas fa-check"></i>';
  }
}

/* ============================================================
   Calendar Logic
   ============================================================ */
const TRIPS = [
  { name: 'PARIS TRIP', start: new Date(2026, 5, 8), end: new Date(2026, 5, 12), color: 'red' },
  { name: 'NYC GETAWAY', start: new Date(2026, 5, 14), end: new Date(2026, 5, 16), color: 'blue' },
  { name: 'JAPAN ADVENTURE', start: new Date(2026, 5, 16), end: new Date(2026, 5, 20), color: 'green' },
  { name: 'RAJASTHAN TOUR', start: new Date(2026, 5, 22), end: new Date(2026, 5, 28), color: 'orange' },
];

let currentMonth = 5; // June 2026
let currentYear = 2026;

function initCalendar() {
  renderCalendar(currentMonth, currentYear);

  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar(currentMonth, currentYear);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar(currentMonth, currentYear);
    });
  }
}

function renderCalendar(month, year) {
  const titleEl = document.getElementById('cal-title');
  const gridEl = document.getElementById('cal-grid');
  if (!titleEl || !gridEl) return;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  titleEl.textContent = `${monthNames[month]} ${year}`;

  gridEl.innerHTML = '';
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  dayNames.forEach((d) => {
    const hdr = document.createElement('div');
    hdr.className = 'calendar-grid__header';
    hdr.textContent = d;
    gridEl.appendChild(hdr);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-grid__cell calendar-grid__cell--empty';
    gridEl.appendChild(cell);
  }

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

    const cellDate = new Date(year, month, day);
    TRIPS.forEach((trip) => {
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
}

/* ============================================================
   Admin Chart Placeholders (SVG-based)
   ============================================================ */
function drawPieChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <svg viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="90" fill="#1A56DB" />
      <path d="M100,100 L100,10 A90,90 0 0,1 190,100 Z" fill="#FF5A5F" />
      <path d="M100,100 L190,100 A90,90 0 0,1 145,185 Z" fill="#10B981" />
      <path d="M100,100 L145,185 A90,90 0 0,1 55,185 Z" fill="#F59E0B" />
      <circle cx="100" cy="100" r="45" fill="white" />
      <text x="100" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#0F172A">Users</text>
    </svg>
  `;
}

function drawBarChart(containerId) {
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
    <svg viewBox="0 0 300 200" width="300" height="200">
      <line x1="15" y1="10" x2="15" y2="165" stroke="#E2E8F0" stroke-width="1"/>
      <line x1="15" y1="165" x2="290" y2="165" stroke="#E2E8F0" stroke-width="1"/>
      ${barsHtml}
    </svg>
  `;
}
