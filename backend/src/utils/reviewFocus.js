import { patronDeDetalle } from './ruleLearning.js';
import { CATEGORIA_INVERSION, CATEGORIA_INTERNO } from '../models/User.js';

// Revisión enfocada (REV-05): qué transacciones de una importación merecen una mirada.
// La misma lógica de motivos está en frontend/src/utils/revision.js (el editor la recalcula en vivo).

const MIN_MUESTRAS = 5;
const FACTOR_LIMITE = 2;
// Movimientos grandes por naturaleza: no se marcan por monto
const SIN_LIMITE = new Set([CATEGORIA_INVERSION, CATEGORIA_INTERNO, 'Otros']);

// Comercio comparable: el patrón del detalle (sin números de operación ni cuotas) en mayúsculas
export const claveComercio = (detalle) => patronDeDetalle(detalle).toUpperCase();

const percentil = (ordenados, p) => ordenados[Math.min(ordenados.length - 1, Math.floor(p * ordenados.length))];

/**
 * A partir del historial del usuario: comercios ya vistos y, por categoría de gasto, el monto
 * desde el que un gasto es raro (el doble del percentil 90; con al menos 5 gastos en la categoría)
 */
export const armarContextoRevision = (historial) => {
  const comercios = new Set();
  const montos = new Map();
  for (const t of historial) {
    const clave = claveComercio(t.detalle);
    if (clave) comercios.add(clave);
    if (t.tipo !== 'Gasto' || SIN_LIMITE.has(t.categoria)) continue;
    if (!montos.has(t.categoria)) montos.set(t.categoria, []);
    montos.get(t.categoria).push(Number(t.importe) || 0);
  }
  const limites = {};
  for (const [categoria, lista] of montos) {
    if (lista.length < MIN_MUESTRAS) continue;
    lista.sort((a, b) => a - b);
    limites[categoria] = Math.round(percentil(lista, 0.9) * FACTOR_LIMITE * 100) / 100;
  }
  return { comercios, limites };
};

/**
 * Agrega `comercio_nuevo` a cada transacción (sin historial no marca ninguna: sería todo)
 */
export const marcarComerciosNuevos = (transactions, comercios) => transactions.map(t => ({
  ...t,
  comercio_nuevo: comercios.size > 0 && !comercios.has(claveComercio(t.detalle))
}));

/**
 * Motivos para revisar una transacción: otros · nuevo · duplicado · interno · monto
 */
export const motivosDeRevision = (t, limites = {}) => {
  if (t.ignorada && !t.duplicado) return [];
  const motivos = [];
  if (t.categoria === 'Otros') motivos.push('otros');
  if (t.comercio_nuevo) motivos.push('nuevo');
  if (t.duplicado) motivos.push('duplicado');
  if (t.interno_sugerido && t.categoria !== CATEGORIA_INTERNO) motivos.push('interno');
  const limite = limites[t.categoria];
  if (t.tipo === 'Gasto' && limite && Number(t.importe) > limite) motivos.push('monto');
  return motivos;
};

export const contarDudosas = (transactions, limites) =>
  transactions.filter(t => motivosDeRevision(t, limites).length > 0).length;
