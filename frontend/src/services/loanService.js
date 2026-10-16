import api from './api';

export const loanService = {
  // Deudores pendientes y saldados con sus movimientos, y total pendiente
  getLoans: async () => {
    const response = await api.get('/loans');
    return response.data;
  },

  // { deudor, concepto, fecha, tipo: 'Prestamo'|'Devolucion', moneda: 'ARS'|'USD', monto, cotizacion_usd? }
  createMovement: async (data) => {
    const response = await api.post('/loans', data);
    return response.data;
  },

  updateMovement: async (id, data) => {
    const response = await api.put(`/loans/${id}`, data);
    return response.data;
  },

  deleteMovement: async (id) => {
    const response = await api.delete(`/loans/${id}`);
    return response.data;
  }
};
