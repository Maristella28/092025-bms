import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';

// Add Axios interceptor to include auth token in requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  console.log('Retrieved token:', token); // Debugging log
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Authorization header set:', config.headers.Authorization); // Debugging log
  } else {
    console.warn('No token found in localStorage'); // Debugging log
  }
  return config;
}, (error) => {
  console.error('Error in Axios request interceptor:', error); // Debugging log
  return Promise.reject(error);
});

const AuthContext = createContext();

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile
  const fetchUser = async () => {
    try {
      // get basic user info first
      const userRes = await axios.get('/user');
      const baseUser = userRes.data;
      // set user early so UI can show role-specific UI
      setUser(baseUser);
      localStorage.setItem('user', JSON.stringify(baseUser || {}));

      // only fetch resident profile for resident users
      if (baseUser?.role === 'residents') {
        const profileRes = await axios.get('/profile');
        const resident = profileRes.data;
        // merge if needed (controller returns resident payload)
        const userData = { ...baseUser, profile: resident.profile ?? resident };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData || {}));
      }

      setIsLoading(false);
    } catch (err) {
      console.error('AuthContext fetchUser error:', err);
      
      // Handle different error types
      if (err.response?.status === 404) {
        // Profile not found - this is normal for new users
        console.log('No profile found for user - this is normal for new users');
        // Try to get basic user info from token
        try {
          const userRes = await axios.get('/user');
          setUser(userRes.data);
          localStorage.setItem('user', JSON.stringify(userRes.data || {}));
        } catch (userErr) {
          console.error('Failed to get basic user info:', userErr);
          setUser(null);
          localStorage.removeItem('user');
        }
      } else if (err.response?.status === 401) {
        // Unauthorized - clear auth data
        console.log('Authentication failed - clearing auth data');
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      } else {
        // Other errors
        console.error('Unexpected error fetching user profile:', err);
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