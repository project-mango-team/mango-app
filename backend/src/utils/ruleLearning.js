import { compilarReglas, buscarRegla } from './categoryRules.js';

/**
 * Texto para una regla aprendida a partir del detalle de un movimiento corregido (REV-03):
 * saca lo que cambia de un movimiento a otro del mismo comercio (cuotas, números de operación,
 * fechas) y deja el resto. "MERPAGO*CAFE 123456 Cuota 02/06" → "MERPAGO*CAFE".
 */
export const patronDeDetalle = (detalle) => String(detalle || '')
  .replace(/\bcuota\s*\d+\s*\/\s*\d+/gi, ' ')
  .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, ' ')
  .replace(/\d{3,}/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/^[\s*\-.#:]+|[\s*\-.#:]+$/g, '')
  .trim();

/**
 * Transacciones ya cargadas a las que la regla les cambiaría la categoría: las que coinciden
 * con sus condiciones y hoy tienen otra. Solo para reglas de categoría.
 */
export const transaccionesACambiar = (transactions, regla) => {
  if (regla?.accion?.tipo !== 'categoria') return [];
  const compiladas = compilarReglas([{ ...regla, activa: true }]);
  return transactions.filter(t => t.categoria !== regla.accion.categoria && buscarRegla(t, compiladas));
};

/**
 * Valida los cambios a deshacer: [{ _id, categoria }] con la categoría que tenían antes
 */
export const validarDeshacer = (cambios) => {
  if (!Array.isArray(cambios) || cambios.length === 0) return { error: 'No hay cambios para deshacer' };
  const validos = cambios.filter(c => c && typeof c._id === 'string' && typeof c.categoria === 'string' && c.categoria.trim());
  if (validos.length !== cambios.length) return { error: 'Cambios inválidos' };
  return { cambios: validos.map(c => ({ _id: c._id, categoria: c.categoria.trim() })) };
};
