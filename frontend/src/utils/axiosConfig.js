import axios from 'axios';

// In Vite development we sometimes see the dev server return 404 before
// the backend is available through the proxy. Use the backend origin when
// running in development so requests go directly to Laravel. In production
// keep the relative `/api` path which is mounted by the server.
const devBase = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api';

const instance = axios.create({
  baseURL: devBase,
  withCredentials: true, // Required for Sanctum cookie-based auth
});

// Attach token to requests
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Centralize 401 handling to avoid per-feature redirects
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Avoid redirect loops during boot; consumers can choose to navigate
      // Optionally, emit a custom event
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default instance;