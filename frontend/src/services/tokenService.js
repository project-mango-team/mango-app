import api from './api';

// Tokens personales para integraciones (script de Gmail)
export const tokenService = {
  listar: async () => {
    const response = await api.get('/tokens');
    return response.data;
  },

  // Devuelve el token completo una sola vez
  crear: async (nombre) => {
    const response = await api.post('/tokens', { nombre });
    return response.data;
  },

  revocar: async (id) => {
    const response = await api.delete(`/tokens/${id}`);
    return response.data;
  }
};
