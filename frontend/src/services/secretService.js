import api from './api';

// Credenciales de terceros guardadas cifradas (solo metadatos: el valor nunca vuelve al navegador)
export const secretService = {
  listar: async () => {
    const response = await api.get('/secrets');
    return response.data;
  },

  borrar: async (nombre) => {
    const response = await api.delete(`/secrets/${encodeURIComponent(nombre)}`);
    return response.data;
  }
};
