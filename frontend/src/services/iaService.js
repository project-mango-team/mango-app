import api from './api'

// Sugerencias de categoría con IA (REV-06)
export const iaService = {
  estado: async () => (await api.get('/categories/sugerencias/estado')).data,
  cambiar: async (activo) => (await api.put('/categories/sugerencias/estado', { activo })).data,
  sugerir: async (transacciones) => (await api.post('/categories/sugerencias', { transacciones })).data
}
