import api from './api'

// Reglas de categorización (REV-02)
export const ruleService = {
  getAll: async () => (await api.get('/categories/reglas')).data,
  create: async (regla) => (await api.post('/categories/reglas', regla)).data,
  update: async (id, regla) => (await api.put(`/categories/reglas/${id}`, regla)).data,
  remove: async (id) => (await api.delete(`/categories/reglas/${id}`)).data,
  reorder: async (ids) => (await api.put('/categories/reglas/orden', { ids })).data
}
