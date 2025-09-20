import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';

// Interceptors centralized in axiosConfig.js

const AuthContext = createContext();

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile (only if token exists)
  const fetchUser = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsLoading(false);
      setUser(null);
      localStorage.removeItem('user');
      return;
    }

    try {
      // Get basic user info first
      const userRes = await axios.get('/user');
      const baseUser = userRes.data?.user || userRes.data; // backend may return { user: ... }

      // Set user early so UI can render role-specific UI
      setUser(baseUser);
      localStorage.setItem('user', JSON.stringify(baseUser || {}));

      // Only fetch resident profile for resident users
      if (baseUser?.role === 'residents') {
        const profileRes = await axios.get('/profile');
        const resident = profileRes.data;
        const userData = { ...baseUser, profile: resident.profile ?? resident };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData || {}));
      }

      setIsLoading(false);
    } catch (err) {
      console.error('AuthContext fetchUser error:', err);

      if (err.response?.status === 404) {
        // Profile not found - normal for new users
        try {
          const userRes = await axios.get('/user');
          const baseUser = userRes.data?.user || userRes.data;
          setUser(baseUser);
          localStorage.setItem('user', JSON.stringify(baseUser || {}));
        } catch (userErr) {
          setUser(null);
          localStorage.removeItem('user');
        }
      } else if (err.response?.status === 401) {
        // Unauthorized - token invalid/expired
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      } else {
        setUser(null);
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    }
  };

  // Login
  const login = async (email, password) => {
    // Get CSRF cookie first for Sanctum
    // Use direct URL to bypass axios baseURL prefix for web routes
    await axios.get(window.location.origin + '/sanctum/csrf-cookie');
    // Login with credentials
    const res = await axios.post('/login', { email, password });
    const token = res.data.token || res.data.access_token;
    if (token) {
      localStorage.setItem('authToken', token);
      console.log('AuthContext login: authToken set in localStorage:', token); // Debug log
    } else {
      console.warn('AuthContext login: No token received from backend');
    }
    await fetchUser();
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post('/logout', {});
    } catch (e) {}
    localStorage.removeItem('authToken');
    setUser(null);
  };

  useEffect(() => {
      fetchUser();
  }, []);

  // Force refresh function for immediate updates
  const forceRefresh = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, fetchUser, forceRefresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth, AuthProvider };
export default AuthProvider;