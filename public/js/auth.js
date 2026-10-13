// public/js/auth.js - Authentication & Session Helper
const AUTH_KEY = 'nattest_auth_token';
const USER_KEY = 'nattest_user_data';

const Auth = {
  getToken() {
    return localStorage.getItem(AUTH_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  isAdmin() {
    const user = this.getUser();
    return user && (user.role === 'ADMIN' || user.role === 'VERIFIKATOR');
  },

  async fetchMe() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        this.clearSession();
        return null;
      }
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
      return null;
    } catch (err) {
      console.error('Auth verification error:', err);
      return null;
    }
  },

  async login(email, password, required_role = null) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, required_role })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async register(name, email, password, phone, birth_date) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone, birth_date })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        // ignore network error on logout
      }
    }
    this.clearSession();
    window.location.href = '/';
  },

  async changePassword(old_password, new_password, confirm_password) {
    const token = this.getToken();
    if (!token) return { success: false, message: 'Silakan login terlebih dahulu' };

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ old_password, new_password, confirm_password })
    });
    return await res.json();
  }
};
