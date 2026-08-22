/**
 * GlobeTrotter — UI Components & Gateway Modal Module
 */
import { AuthService } from './auth.js';

export const UIService = {
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

    // Enforce Admin link visibility in navigation
    if (nav) {
      const adminLink = nav.querySelector('a[href="admin.html"]');
      if (adminLink) {
        adminLink.style.display = isAdmin ? 'inline-block' : 'none';
      }
    }

    // Render user profile pill or sign-in trigger
    if (profileSlot) {
      if (user) {
        const displayName = user.firstName || user.username || 'Traveler';
        const roleBadge = isAdmin ? '<span class="header__role-badge">Admin</span>' : '';
        profileSlot.outerHTML = `
          <div class="header__user-pill" title="Click to view profile" onclick="window.location.href='profile.html'">
            <img src="${user.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" alt="${displayName}" class="header__user-avatar">
            <span>${displayName}</span>
            ${roleBadge}
            <i class="fas fa-right-from-bracket" title="Log Out" style="margin-left: 6px; font-size: 0.8rem; opacity: 0.8;" onclick="event.stopPropagation(); window.AuthService.logout();"></i>
          </div>
        `;
      } else {
        profileSlot.outerHTML = `
          <button type="button" class="btn btn--sm" style="background: rgba(255,255,255,0.2); color: #fff; font-weight: 700; border-radius: 20px; padding: 6px 16px;" onclick="window.UIService.openAuthModal('login')">
            <i class="fas fa-user-circle"></i> Sign In / Register
          </button>
        `;
      }
    }
  },

  openAuthModal(initialTab = 'login') {
    let modal = document.getElementById('authGatewayModal');
    if (!modal) {
      modal = this.createAuthModalDOM();
    }
    modal.classList.add('active');
    this.switchAuthTab(initialTab);
  },

  closeAuthModal() {
    const modal = document.getElementById('authGatewayModal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  switchAuthTab(tab) {
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
  },

  createAuthModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'authGatewayModal';
    modal.className = 'auth-gateway-modal';

    modal.innerHTML = `
      <div class="auth-gateway-card">
        <button type="button" class="auth-close-btn" onclick="window.UIService.closeAuthModal()" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>

        <div class="auth-gateway-header">
          <div class="auth-gateway-brand">
            <i class="fas fa-globe-americas"></i> GlobeTrotter
          </div>
          <p class="auth-gateway-subtitle">Sign in or create your explorer account to start planning.</p>
        </div>

        <div class="auth-tabs-nav">
          <div id="gtTabLoginBtn" class="auth-tab-btn active" onclick="window.UIService.switchAuthTab('login')">
            <i class="fas fa-lock"></i> Login
          </div>
          <div id="gtTabSignupBtn" class="auth-tab-btn" onclick="window.UIService.switchAuthTab('signup')">
            <i class="fas fa-user-plus"></i> Sign Up
          </div>
        </div>

        <!-- Login Form Pane -->
        <div id="gtPaneLogin" class="auth-tab-pane active">
          <form id="gtLoginForm" onsubmit="window.handleModalLogin(event)">
            <div class="form-group">
              <label class="form-label" for="gtLoginEmail">Email or Username</label>
              <input type="text" id="gtLoginEmail" class="form-control" placeholder="Enter your email or username" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="gtLoginPassword">Password</label>
              <input type="password" id="gtLoginPassword" class="form-control" placeholder="Enter your password" required>
            </div>
            <button type="submit" id="gtLoginSubmit" class="btn btn--primary btn--block" style="padding: 12px; font-weight: 700; margin-top: 10px;">
              <span>Sign In to GlobeTrotter</span>
              <i class="fas fa-arrow-right"></i>
            </button>
          </form>
        </div>

        <!-- Sign Up Form Pane -->
        <div id="gtPaneSignup" class="auth-tab-pane">
          <form id="gtSignupForm" onsubmit="window.handleModalSignup(event)">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="gtRegFirst">First Name *</label>
                <input type="text" id="gtRegFirst" class="form-control" placeholder="First Name" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="gtRegLast">Last Name *</label>
                <input type="text" id="gtRegLast" class="form-control" placeholder="Last Name" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="gtRegEmail">Email Address *</label>
              <input type="email" id="gtRegEmail" class="form-control" placeholder="name@example.com" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="gtRegPassword">Password (8+ chars, 1 letter & 1 digit) *</label>
              <input type="password" id="gtRegPassword" class="form-control" placeholder="Create strong password" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="gtRegCity">City & Country</label>
              <input type="text" id="gtRegCity" class="form-control" placeholder="e.g. Mumbai, India">
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

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeAuthModal();
    });

    return modal;
  },
};
