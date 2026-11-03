// Movimientos de Inversiones que salen de las transacciones de un extracto (INV-03).
// Funciones puras: no tocan la DB. Una transacción "Inversión" del extracto (Gasto = plata que sale hacia el
// fondo, Ingreso = rescate) se convierte en un Aporte o un Retiro del activo elegido por una regla.

import { emparejarConTolerancia } from './investmentImport.js';

export const DIAS_TOLERANCIA = 3;

const TIPO_DE_TRANSACCION = { Gasto: 'Aporte', Ingreso: 'Retiro' };

/**
 * Fecha de una transacción (DD/MM/YYYY, DD-MM-YY o YYYY-MM-DD) a YYYY-MM-DD, o null si no se entiende
 */
export const fechaISO = (fecha) => {
  const texto = String(fecha ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const partes = texto.replace(/-/g, '/').split('/');
  if (partes.length !== 3) return null;
  let [d, m, y] = partes;
  if (y.length === 2) y = `20${y}`;
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/**
 * Movimiento que correspondería a una transacción para un activo. La moneda del movimiento tiene que
 * ser la del activo: no se convierte nada.
 * @param {{ fecha, tipo, moneda?, importe, monto_original? }} transaccion
 * @param {{ moneda: string }} activo
 * @returns {{ movimiento: { fecha: string, tipo: 'Aporte'|'Retiro', monto: number } } | { error: string }}
 */
export const movimientoDesdeTransaccion = (transaccion, activo) => {
  const tipo = TIPO_DE_TRANSACCION[transaccion?.tipo];
  if (!tipo) return { error: 'Solo los gastos y los ingresos pueden cargarse en Inversiones' };

  const fecha = fechaISO(transaccion.fecha);
  if (!fecha) return { error: 'No se entiende la fecha de la transacción' };

  const moneda = transaccion.moneda || 'ARS';
  if (moneda !== activo?.moneda) {
    return { error: `La transacción está en ${moneda} y el activo en ${activo?.moneda || 'otra moneda'}: cargala a mano en Inversiones` };
  }

  const monto = Math.abs(Number(moneda === 'ARS' ? transaccion.importe : transaccion.monto_original));
  if (!(monto > 0)) return { error: 'La transacción no tiene un monto válido' };

  return { movimiento: { fecha, tipo, monto: Math.round(monto * 100) / 100 } };
};

/**
 * Arma el plan de inversiones de un grupo de transacciones, en el mismo orden.
 * Cada transacción con `inversion.activo_id` devuelve:
 *   { activo_id, activo_nombre, movimiento, crear, duplicado: { fecha } | null, error: string | null }
 * `crear` es verdadero si no hay error ni un movimiento ya cargado equivalente (mismo tipo y monto, ±3 días);
 * dentro del mismo lote cada movimiento existente se empareja con una sola transacción.
 * Las transacciones sin `inversion` devuelven null.
 * @param {Array} transacciones
 * @param {Map<string, { _id, nombre, moneda }>} activos - por id (string), solo los del usuario
 * @param {Map<string, Array<{ fecha, tipo, monto }>>} existentesPorActivo - movimientos ya cargados, por id de activo
 */
export const planDeInversiones = (transacciones, activos, existentesPorActivo = new Map()) => {
  const plan = transacciones.map(() => null);
  const porActivo = new Map();

  transacciones.forEach((t, i) => {
    const id = t?.inversion?.activo_id ? String(t.inversion.activo_id) : null;
    if (!id) return;
    const activo = activos.get(id);
    if (!activo) {
      plan[i] = { activo_id: id, activo_nombre: null, movimiento: null, crear: false, duplicado: null, error: 'La inversión elegida ya no existe' };
      return;
    }
    const { movimiento, error } = movimientoDesdeTransaccion(t, activo);
    plan[i] = { activo_id: id, activo_nombre: activo.nombre, movimiento: movimiento || null, crear: false, duplicado: null, error: error || null };
    if (movimiento) {
      if (!porActivo.has(id)) porActivo.set(id, []);
      porActivo.get(id).push(i);
    }
  });

  for (const [id, indices] of porActivo) {
    const pares = emparejarConTolerancia(
      indices.map(i => plan[i].movimiento),
      existentesPorActivo.get(id) || [],
      { dias: DIAS_TOLERANCIA }
    );
    indices.forEach((i, k) => {
      const existente = pares[k];
      if (existente) {
        plan[i].duplicado = { fecha: new Date(existente.fecha).toISOString().slice(0, 10) };
      } else {
        plan[i].crear = true;
      }
    });
  }
  return plan;
};
