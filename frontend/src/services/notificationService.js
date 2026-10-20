import api from './api';

// Centro de avisos in-app
export const notificationService = {
  listar: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  noLeidas: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  marcarLeida: async (id) => {
    const response = await api.post(`/notifications/${id}/read`);
    return response.data;
  },

  marcarTodas: async () => {
    const response = await api.post('/notifications/read-all');
    return response.data;
  }
};
