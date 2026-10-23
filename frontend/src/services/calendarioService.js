import api from './api';

// Calendario de cierres de los resúmenes (ING-09)
export const calendarioService = {
  obtener: async () => {
    const response = await api.get('/calendario');
    return response.data;
  },

  // { dia_cierre, llegada, activa }
  guardarFuente: async (fuente, config) => {
    const response = await api.put(`/calendario/${encodeURIComponent(fuente)}`, config);
    return response.data;
  },

  quitarFuente: async (fuente) => {
    const response = await api.delete(`/calendario/${encodeURIComponent(fuente)}`);
    return response.data;
  }
};
