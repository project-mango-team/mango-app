import api from './api';

export const dolarService = {
  // Get current dollar rate (oficial venta) used as default for card imports
  getCotizacion: async () => {
    const response = await api.get('/dolar/cotizacion');
    return response.data;
  }
};
