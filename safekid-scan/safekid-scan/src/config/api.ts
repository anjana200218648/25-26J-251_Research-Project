// src/config/api.ts
// support two separate backends: general data API and authentication API
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8001';

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  AUTH_URL: AUTH_API_URL,
  ENDPOINTS: {
    ANALYZE: '/api/analyze',
    HEALTH: '/api/health'
  }
};

export const isDevelopment = import.meta.env.DEV;