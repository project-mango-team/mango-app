import api from './api'

// Reglas de categorización (REV-02)
export const ruleService = {
  getAll: async () => (await api.get('/categories/reglas')).data,
  create: async (regla) => (await api.post('/categories/reglas', regla)).data,
  update: async (id, regla) => (await api.put(`/categories/reglas/${id}`, regla)).data,
  remove: async (id) => (await api.delete(`/categories/reglas/${id}`)).data,
  reorder: async (ids) => (await api.put('/categories/reglas/orden', { ids })).data,
  // REV-03: aprender de una corrección
  patron: async (detalle) => (await api.get('/categories/reglas/patron', { params: { detalle } })).data,
  coincidencias: async (id) => (await api.get(`/categories/reglas/${id}/coincidencias`)).data,
  aplicar: async (id) => (await api.post(`/categories/reglas/${id}/aplicar`)).data,
  deshacer: async (cambios) => (await api.post('/categories/reglas/deshacer', { cambios })).data
}
