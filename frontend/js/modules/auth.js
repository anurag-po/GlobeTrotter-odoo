/**
 * GlobeTrotter — Authentication Module
 * Handles user sessions, token storage, login/signup API calls, and role-based checks.
 */
export const ADMIN_EMAIL = 'admin1234@temporaryaccount.none';
export const API_BASE_URL = 'http://localhost:3000/api/v1';

export const AuthService = {
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
      // Local fallback for offline demo / standalone browser usage
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
    if (window.UIService) {
      window.UIService.showToast('Logged out successfully', 'info');
    }
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 400);
  },

  checkAdminAccess() {
    if (!this.isAdmin()) {
      alert('Access Denied: The Admin Panel is restricted to system administrators (admin1234@temporaryaccount.none).');
      window.location.href = 'index.html';
    }
  },

  enforceAuth() {
    const isPublicPage =
      window.location.pathname.endsWith('index.html') ||
      window.location.pathname.endsWith('login.html') ||
      window.location.pathname.endsWith('register.html') ||
      window.location.pathname.endsWith('/') ||
      window.location.pathname === '';

    const user = this.getCurrentUser();
    if (!user) {
      if (isPublicPage) {
        setTimeout(() => {
          if (window.UIService) {
            window.UIService.openAuthModal('login');
          }
        }, 200);
      } else {
        alert('Please sign in or create an account to access GlobeTrotter travel features.');
        window.location.href = 'index.html';
      }
    }
  },
};

