import api from './api';

export const investmentService = {
  getPortfolio: async () => {
    const response = await api.get('/investments/portfolio');
    return response.data;
  },

  // { desde?, hasta? } en YYYY-MM-DD
  getPerformance: async ({ desde, hasta } = {}) => {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    const response = await api.get('/investments/performance', { params });
    return response.data;
  },

  getAssets: async (estado = 'todos') => {
    const response = await api.get('/investments/assets', { params: { estado } });
    return response.data;
  },

  getAsset: async (id) => {
    const response = await api.get(`/investments/assets/${id}`);
    return response.data;
  },

  createAsset: async (data) => {
    const response = await api.post('/investments/assets', data);
    return response.data;
  },

  updateAsset: async (id, data) => {
    const response = await api.put(`/investments/assets/${id}`, data);
    return response.data;
  },

  deleteAsset: async (id) => {
    const response = await api.delete(`/investments/assets/${id}`);
    return response.data;
  },

  createMovement: async (assetId, data) => {
    const response = await api.post(`/investments/assets/${assetId}/movements`, data);
    return response.data;
  },

  updateMovement: async (assetId, movId, data) => {
    const response = await api.put(`/investments/assets/${assetId}/movements/${movId}`, data);
    return response.data;
  },

  deleteMovement: async (assetId, movId) => {
    const response = await api.delete(`/investments/assets/${assetId}/movements/${movId}`);
    return response.data;
  },

  // Lee operaciones pegadas desde la app del broker (Fima) y marca las ya cargadas
  previewImport: async (assetId, texto) => {
    const response = await api.post(`/investments/assets/${assetId}/import/preview`, { texto });
    return response.data;
  },

  // movimientos: [{ fecha, tipo: 'Aporte'|'Retiro', monto, notas? }]
  importMovements: async (assetId, movimientos) => {
    const response = await api.post(`/investments/assets/${assetId}/import`, { movimientos });
    return response.data;
  },

  // { fecha, cotizacion_usd?, cotizacion_eur?, valuaciones: [{ asset_id, monto }] }
  createValuations: async (data) => {
    const response = await api.post('/investments/valuations', data);
    return response.data;
  },

  getTypes: async () => {
    const response = await api.get('/investments/types');
    return response.data;
  },

  createType: async (nombre, liquido) => {
    const response = await api.post('/investments/types', { nombre, liquido });
    return response.data;
  }
};
