import api from './api';

// Cuenta de Mercado Pago conectada por API (el token nunca vuelve al navegador)
export const mercadoPagoService = {
  estado: async () => {
    const response = await api.get('/mercadopago/cuenta');
    return response.data;
  },

  conectar: async (token) => {
    const response = await api.put('/mercadopago/cuenta', { token });
    return response.data;
  },

  probar: async () => {
    const response = await api.post('/mercadopago/cuenta/probar');
    return response.data;
  },

  desconectar: async () => {
    const response = await api.delete('/mercadopago/cuenta');
    return response.data;
  }
};
