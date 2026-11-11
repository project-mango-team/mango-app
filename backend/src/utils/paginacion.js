// limit/skip de una query string, tolerante a basura (NaN, negativos, arrays u objetos de query)
export const parsearPaginacion = (query = {}, { porDefecto = 50, maximo = 100 } = {}) => {
  const entero = (valor) => (typeof valor === 'string' && /^\d+$/.test(valor.trim()) ? parseInt(valor, 10) : null);
  const limit = entero(query.limit);
  const skip = entero(query.skip);
  return {
    limit: limit === null || limit < 1 ? porDefecto : Math.min(limit, maximo),
    skip: skip === null ? 0 : Math.min(skip, 1000000)
  };
};
