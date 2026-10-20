import api from './api';

// Tareas programadas del backend (solo administradores)
export const jobService = {
  listar: async () => {
    const response = await api.get('/jobs');
    return response.data;
  },

  correr: async (nombre) => {
    const response = await api.post(`/jobs/${encodeURIComponent(nombre)}/run`);
    return response.data;
  }
};
