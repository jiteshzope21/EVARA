import api from './api';

const TOKEN_KEY = 'evara_token';
const USER_KEY = 'evara_user';

export const authService = {
  /**
   * Register a new user account.
   * Backend contract: POST /api/auth/register
   * Body: { name, email, password }
   * Returns: { access_token, token_type: "bearer", user: { id, name, email, created_at } }
   */
  async register(name, email, password) {
    const response = await api.post('/api/auth/register', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  /**
   * Log in with existing credentials.
   * Backend contract: POST /api/auth/login
   * Body: { email, password }
   * Returns: { access_token, token_type: "bearer", user: { id, name, email, created_at } }
   */
  async login(email, password) {
    const response = await api.post('/api/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  /**
   * Retrieve current user profile using stored JWT.
   * Backend contract: GET /api/auth/me
   * Headers: Authorization: Bearer <token>
   * Returns: { id, name, email, created_at }
   */
  async getCurrentUser() {
    const response = await api.get('/api/auth/me');
    const user = response.data;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  /**
   * Log out current user and clear stored authentication state.
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Retrieve the stored access token from localStorage.
   */
  getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Retrieve the stored user object from localStorage.
   */
  getStoredUser() {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
};

export default authService;
