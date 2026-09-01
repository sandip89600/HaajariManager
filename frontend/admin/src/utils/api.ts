import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const DEFAULT_API_URL = 'https://haajarimanager.onrender.com/api';

const BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Admin JWT Bearer token
api.interceptors.request.use(
  (config) => {
    let token = useAuthStore.getState().token;

    // Fallback: Read token directly from localStorage if store is initializing
    if (!token && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('haajari-admin-auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.state?.token || null;
        }
      } catch {
        // ignore parse error
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized token expiration & rotation
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Expired or invalid token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        // Call token rotation endpoint
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { token: newAccessToken, refreshToken: newRefreshToken } = res.data;

        // Update store tokens
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        // Update request headers and retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear auth state and redirect to Admin Login
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
