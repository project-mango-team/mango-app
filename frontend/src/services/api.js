import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Use proxy in development, or configure VITE_API_URL for production
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Enable cookies for session management
});

// Interceptor para manejar errores globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      // Don't redirect if already on login page or auth endpoints
      if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
        console.warn('Session expired or not authenticated')
        // Optionally redirect to login
        // window.location.href = '/login'
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
