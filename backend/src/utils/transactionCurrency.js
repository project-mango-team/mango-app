// Conversión de transacciones a USD al momento de leerlas (no se guarda nada en la DB).
// Funciones puras: reciben el historial de cotizaciones ya cargado.
import { cotizacionEnFecha } from './investmentCalc.js';

/**
 * "DD/MM/YYYY" (formato de Transaction.fecha) → "YYYY-MM-DD", o null si no tiene ese formato
 */
export const fechaTransaccionISO = (fecha) => {
  const match = String(fecha ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};

/**
 * Monto de una transacción en USD:
 * - si fue en dólares, el monto original (lo que realmente se pagó en USD)
 * - si fue en pesos, el importe dividido por el dólar blue del día del movimiento
 * @param {{ importe: number, moneda?: string, monto_original?: number, fecha: string }} transaccion
 * @param {Array<{ fecha: string, promedio: number }>} historialBlue - ordenado por fecha
 * @returns {number}
 */
export const montoTransaccionUsd = (transaccion, historialBlue) => {
  if (transaccion.moneda === 'USD' && Number.isFinite(transaccion.monto_original)) {
    return Math.abs(transaccion.monto_original);
  }
  const fecha = fechaTransaccionISO(transaccion.fecha);
  const cotizacion = fecha ? cotizacionEnFecha(historialBlue, fecha) : undefined;
  return cotizacion > 0 ? transaccion.importe / cotizacion : 0;
};
