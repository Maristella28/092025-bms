import axios from 'axios';

const instance = axios.create({
  baseURL: '/api', // Use relative path to go through Vite proxy
  withCredentials: true, // Required for Sanctum cookie-based auth
});

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

export default instance;