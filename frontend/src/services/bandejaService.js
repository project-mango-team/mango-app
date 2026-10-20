import api from './api';

// Bandeja de resúmenes: archivos que se suben (o llegan) y quedan para revisar e importar
export const bandejaService = {
  listar: async () => {
    const response = await api.get('/bandeja');
    return response.data;
  },

  pendientes: async () => {
    const response = await api.get('/bandeja/pendientes');
    return response.data;
  },

  // files: FileList o array de File
  subir: async (files) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const response = await api.post('/bandeja', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  transacciones: async (id) => {
    const response = await api.get(`/bandeja/${id}/transacciones`);
    return response.data;
  },

  // { tipo?, tipoResumen?, valorDolar?, selectedCards? }
  actualizarParametros: async (id, parametros) => {
    const response = await api.put(`/bandeja/${id}/parametros`, parametros);
    return response.data;
  },

  // transactions opcional: las editadas en la revisión
  importar: async (id, transactions) => {
    const response = await api.post(`/bandeja/${id}/importar`, transactions ? { transactions } : {});
    return response.data;
  },

  importarListos: async () => {
    const response = await api.post('/bandeja/importar-listos');
    return response.data;
  },

  descartar: async (id) => {
    const response = await api.post(`/bandeja/${id}/descartar`);
    return response.data;
  },

  deshacer: async (operationId) => {
    const response = await api.delete(`/upload/rollback/${operationId}`);
    return response.data;
  }
};
