// src/config/api.ts
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  ENDPOINTS: {
    ANALYZE: '/api/analyze',
    HEALTH: '/api/health'
  }
};

export const isDevelopment = import.meta.env.DEV;