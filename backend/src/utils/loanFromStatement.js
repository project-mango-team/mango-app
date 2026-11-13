// Préstamos que salen de las transferencias de un extracto (PUL-07). Funciones puras: no tocan la DB.
// Una transacción marcada como préstamo (regla 'prestamo' o elegida en la revisión) se registra en Préstamos:
// Gasto = plata que sale hacia el deudor (Prestamo), Ingreso = plata que vuelve (Devolucion).

import { emparejarConTolerancia } from './investmentImport.js';
import { fechaISO, DIAS_TOLERANCIA } from './investmentFromStatement.js';
import { montoPrestamoUsd } from './loanCalc.js';

const TIPO_DE_TRANSACCION = { Gasto: 'Prestamo', Ingreso: 'Devolucion' };
const EPSILON = 0.005;
const clave = (deudor) => String(deudor || '').trim().toLowerCase();
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Plan de préstamos de un grupo de transacciones, en el mismo orden. Cada transacción con `prestamo` devuelve:
 *   { deudor, movimiento: { fecha, tipo, moneda, monto, monto_usd } | null, crear, duplicado: { fecha } | null, error }
 * `crear` es verdadero si no hay error ni un movimiento equivalente ya cargado (mismo deudor, tipo, moneda y monto,
 * ±3 días, o el mismo transaction_id). Una devolución que supera el saldo del deudor es un error. Las transacciones sin
 * `prestamo` devuelven null.
 * @param {Array} transacciones
 * @param {Array<{ _id?, deudor, tipo, moneda, fecha, monto, monto_usd, transaction_id? }>} existentes - movimientos de préstamos del usuario
 * @param {(fechaISO: string) => number} cotizacionDe - ARS por USD de esa fecha
 */
export const planDePrestamos = (transacciones, existentes = [], cotizacionDe = () => 0) => {
  const plan = transacciones.map(() => null);
  const grupos = new Map(); // deudor|moneda -> índices

  transacciones.forEach((t, i) => {
    if (!t?.prestamo) return;
    const deudor = String(t.prestamo.deudor || '').trim().replace(/\s+/g, ' ');
    const base = { deudor, movimiento: null, crear: false, duplicado: null, error: null };
    plan[i] = base;
    if (!deudor) { base.error = 'Falta el nombre de quien recibió el préstamo'; return; }
    const tipo = TIPO_DE_TRANSACCION[t.tipo];
    if (!tipo) { base.error = 'Solo los gastos y los ingresos pueden registrarse como préstamo'; return; }
    const fecha = fechaISO(t.fecha);
    if (!fecha) { base.error = 'No se entiende la fecha de la transacción'; return; }
    const moneda = t.moneda || 'ARS';
    if (!['ARS', 'USD'].includes(moneda)) { base.error = `Los préstamos se llevan en ARS o USD, no en ${moneda}`; return; }
    const monto = Math.abs(Number(moneda === 'ARS' ? t.importe : t.monto_original));
    if (!(monto > 0)) { base.error = 'La transacción no tiene un monto válido'; return; }

    let montoUsd;
    try {
      montoUsd = redondear(montoPrestamoUsd(redondear(monto), moneda, cotizacionDe(fecha)));
    } catch {
      base.error = 'No se pudo obtener la cotización del dólar de esa fecha';
      return;
    }
    base.movimiento = { fecha, tipo, moneda, monto: redondear(monto), monto_usd: montoUsd };
    const k = `${clave(deudor)}|${moneda}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  });

  // Duplicados: contra lo ya cargado del mismo deudor y moneda
  for (const indices of grupos.values()) {
    const { deudor, movimiento: { moneda } } = plan[indices[0]];
    const delDeudor = existentes.filter(m => clave(m.deudor) === clave(deudor) && m.moneda === moneda);
    const yaVinculadas = new Set(delDeudor.filter(m => m.transaction_id).map(m => String(m.transaction_id)));
    const libres = delDeudor.filter(m => !m.transaction_id || !indices.some(i => String(transacciones[i]._id) === String(m.transaction_id)));
    const sinVincular = indices.filter(i => {
      if (transacciones[i]._id !== undefined && yaVinculadas.has(String(transacciones[i]._id))) {
        plan[i].duplicado = { fecha: plan[i].movimiento.fecha };
        return false;
      }
      return true;
    });
    const pares = emparejarConTolerancia(sinVincular.map(i => plan[i].movimiento), libres, { dias: DIAS_TOLERANCIA });
    sinVincular.forEach((i, k) => {
      if (pares[k]) plan[i].duplicado = { fecha: new Date(pares[k].fecha).toISOString().slice(0, 10) };
      else plan[i].crear = true;
    });
  }

  // Saldo: una devolución no puede superar lo que el deudor debe (contando los préstamos del mismo lote)
  const porDeudor = new Map();
  plan.forEach((p, i) => { if (p?.crear) { const k = clave(p.deudor); if (!porDeudor.has(k)) porDeudor.set(k, []); porDeudor.get(k).push(i); } });
  for (const [k, indices] of porDeudor) {
    let saldo = existentes
      .filter(m => clave(m.deudor) === k)
      .reduce((s, m) => s + (m.tipo === 'Prestamo' ? m.monto_usd : -m.monto_usd), 0);
    const ordenados = [...indices].sort((a, b) => plan[a].movimiento.fecha.localeCompare(plan[b].movimiento.fecha)
      || (plan[a].movimiento.tipo === 'Prestamo' ? -1 : 1));
    for (const i of ordenados) {
      const m = plan[i].movimiento;
      if (m.tipo === 'Prestamo') { saldo += m.monto_usd; continue; }
      if (m.monto_usd > saldo + EPSILON) {
        plan[i].crear = false;
        plan[i].error = `La devolución supera lo que ${plan[i].deudor} te debe (saldo US$ ${redondear(Math.max(saldo, 0))})`;
      } else {
        saldo -= m.monto_usd;
      }
    }
  }
  return plan;
};
