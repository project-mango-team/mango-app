// Tipos de activo base. El usuario puede sumar los suyos en User.investmentTypes.
// `liquido` define qué entra en el total de liquidez del portfolio.
export const DEFAULT_INVESTMENT_TYPES = [
  { nombre: 'Efectivo', liquido: true },
  { nombre: 'Cuenta remunerada', liquido: true },
  { nombre: 'FCI', liquido: true },
  { nombre: 'Cripto', liquido: true },
  { nombre: 'Plazo fijo', liquido: false },
  { nombre: 'ETF', liquido: false },
  { nombre: 'Acciones', liquido: false },
  { nombre: 'Bonos', liquido: false }
];

/**
 * Tipos base + tipos propios del usuario (los propios no pisan a los base)
 * @param {Object} user - Documento User
 * @returns {Array<{ nombre: string, liquido: boolean, custom: boolean }>}
 */
export const getInvestmentTypes = (user) => {
  const base = DEFAULT_INVESTMENT_TYPES.map(t => ({ ...t, custom: false }));
  const baseNames = new Set(base.map(t => t.nombre.toLowerCase()));
  const custom = (user?.investmentTypes || [])
    .filter(t => !baseNames.has(t.nombre.toLowerCase()))
    .map(t => ({ nombre: t.nombre, liquido: t.liquido, custom: true }));
  return [...base, ...custom];
};
