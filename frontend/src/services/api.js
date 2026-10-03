import axios from 'axios';

// Base API instance
// In development, empty baseURL allows Vite's proxy (/api -> http://localhost:8000) to handle requests.
// In production or custom setup, VITE_API_URL can specify the backend host.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('evara_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s and normalize error formatting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Unauthorized handling
    if (error.response && error.response.status === 401) {
      // Clear token and cached user
      localStorage.removeItem('evara_token');
      localStorage.removeItem('evara_user');
      
      // If unauthorized on a protected route (excluding /api/auth/login), trigger redirect if in browser context
      const isLoginRequest = error.config?.url?.includes('/api/auth/login');
      if (!isLoginRequest && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to extract a user-readable error message from backend responses.
 * Handles FastAPI string details, 422 validation error arrays, and generic errors.
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  if (typeof error === 'string') return error;

  const data = error.response?.data;
  if (!data) {
    if (error.message === 'Network Error') {
      return 'Unable to connect to the backend server. Please verify the server is running.';
    }
    return error.message || 'An error occurred while communicating with the server.';
  }

  // FastAPI HTTPException detail (string)
  if (typeof data.detail === 'string') {
    return data.detail;
  }

  // FastAPI validation error (list of error objects in data.detail or data.errors)
  const validationErrors = Array.isArray(data.detail) ? data.detail : data.errors;
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return validationErrors
      .map((err) => {
        const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
        return `${field}: ${err.msg}`;
      })
      .join('; ');
  }

  return 'Server responded with an error.';
}

export default api;
