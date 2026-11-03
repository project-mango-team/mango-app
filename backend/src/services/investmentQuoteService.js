import { DolarService, hoyArgentina } from './dolarService.js';
import { cotizacionEnFecha } from '../utils/investmentCalc.js';

// Cotizaciones que usa Inversiones para convertir los movimientos (dólar blue y euro equivalente).
// Vive acá para compartirlo entre el controller y la carga desde un extracto (INV).

/**
 * Cotizaciones de hoy: blue promedio y, si hace falta, euro equivalente
 */
export const getCotizacionesHoy = async (incluirEuro) => {
  const usd = (await DolarService.getBlue()).promedio;
  const eur = incluirEuro ? (await DolarService.getEuro()).promedio : undefined;
  return { usd, eur };
};

/**
 * Función fecha → cotizaciones { usd, eur? } para muchas fechas con una sola llamada por moneda:
 * hoy usa la cotización en vivo (igual que Portfolio) y los días pasados, el historial.
 * El historial del euro arranca en 2023: antes de eso se usa su primer valor.
 */
export const crearCotizacionesEn = async (necesitaEuro) => {
  const hoy = hoyArgentina();
  const [historialUsd, historialEur, cotHoy] = await Promise.all([
    DolarService.getHistorial('blue'),
    necesitaEuro ? DolarService.getHistorialEuro() : null,
    getCotizacionesHoy(necesitaEuro)
  ]);
  const cotizacionesEn = (fecha) => (fecha >= hoy
    ? cotHoy
    : { usd: cotizacionEnFecha(historialUsd, fecha), eur: historialEur ? cotizacionEnFecha(historialEur, fecha) : undefined });
  return { cotizacionesEn, cotHoy };
};
