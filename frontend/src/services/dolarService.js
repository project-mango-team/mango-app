import api from './api';

export const dolarService = {
  // Get current dollar rate (oficial venta) used as default for card imports
  getCotizacion: async () => {
    const response = await api.get('/dolar/cotizacion');
    return response.data;
  },

  // Dólar blue (promedio compra/venta) para inversiones; fecha YYYY-MM-DD opcional
  getBlue: async (fecha) => {
    const response = await api.get('/dolar/blue', { params: fecha ? { fecha } : {} });
    return response.data;
  },

  // Euro (promedio compra/venta) para inversiones; fecha YYYY-MM-DD opcional
  getEuro: async (fecha) => {
    const response = await api.get('/dolar/euro', { params: fecha ? { fecha } : {} });
    return response.data;
  }
};
