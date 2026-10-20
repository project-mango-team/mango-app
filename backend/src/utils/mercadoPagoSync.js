// Planificación de la sync diaria de Mercado Pago (MP-03): qué período traer y qué reporte usar.
// Funciones puras; el job las combina con el cliente (services/mercadoPagoClient.js) y la Bandeja.
// Ver plans/mercadopago.md.

import { MAX_DIAS_REPORTE } from '../services/mercadoPagoClient.js';

// Sin nada importado ni sincronizado, la primera sync trae los últimos 30 días
export const DIAS_PRIMERA_SYNC = 30;

const DIA_MS = 86400000;

// YYYY-MM-DD de una fecha en hora de Argentina (UTC-3, sin horario de verano)
const isoArgentina = (fecha) => new Date(fecha.getTime() - 3 * 3600000).toISOString().slice(0, 10);

const sumarDias = (iso, dias) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);

/**
 * DD/MM/YYYY (o DD-MM-YYYY) a YYYY-MM-DD; null si no es una fecha
 */
export const fechaMangoAIso = (fecha) => {
  const m = String(fecha ?? '').trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/**
 * Período que tiene que traer la próxima sync. Arranca el día siguiente a lo último que ya hay
 * (lo importado a mano o lo que trajo la sync anterior), así la API no se superpone con el CSV
 * subido a mano, y termina ayer: el día de hoy todavía no está cerrado.
 * Si falta más de lo que entra en un reporte, trae los primeros 60 días y la sync siguiente sigue.
 * @param {{ ultimaFechaImportada?: string|null, ultimaSync?: string|null, ahora?: Date }} estado
 *   ultimaFechaImportada: DD/MM/YYYY del último movimiento de Mercado Pago ya cargado
 *   ultimaSync: YYYY-MM-DD hasta donde trajo la sync anterior
 * @returns {{ desde: string, hasta: string }|null} YYYY-MM-DD, o null si no falta nada
 */
export const ventanaSync = ({ ultimaFechaImportada = null, ultimaSync = null, ahora = new Date() } = {}) => {
  const ayer = sumarDias(isoArgentina(ahora), -1);
  const ultima = [fechaMangoAIso(ultimaFechaImportada), ultimaSync].filter(Boolean).sort().at(-1);
  const desde = ultima ? sumarDias(ultima, 1) : sumarDias(ayer, 1 - DIAS_PRIMERA_SYNC);
  if (desde > ayer) return null;
  const tope = sumarDias(desde, MAX_DIAS_REPORTE - 1);
  return { desde, hasta: tope < ayer ? tope : ayer };
};

/**
 * Límites para pedir el reporte de la ventana: del primer al último segundo, en hora de Argentina
 * @returns {{ desde: string, hasta: string }} ISO con zona
 */
export const limitesReporte = ({ desde, hasta }) => ({
  desde: `${desde}T00:00:00-03:00`,
  hasta: `${hasta}T23:59:59-03:00`
});

/**
 * Reporte ya generado que cubre toda la ventana (el más nuevo si hay varios)
 * @param {Object[]} reportes - salida de listarReportes ({ file_name, begin_date, end_date, status })
 * @returns {Object|null}
 */
export const reporteParaVentana = (reportes, ventana) => {
  const { desde, hasta } = limitesReporte(ventana);
  const inicio = Date.parse(desde);
  const fin = Date.parse(hasta);
  return (reportes || [])
    .filter(r => r.file_name && (!r.status || r.status === 'processed'))
    .filter(r => Date.parse(r.begin_date) <= inicio && Date.parse(r.end_date) >= fin)
    .sort((a, b) => Date.parse(b.date_created ?? b.end_date) - Date.parse(a.date_created ?? a.end_date))[0] ?? null;
};

/**
 * ¿Hay un reporte de la ventana pedido y todavía en preparación? Para no pedirlo de nuevo.
 */
export const reporteEnPreparacion = (reportes, ventana) => {
  const { desde, hasta } = limitesReporte(ventana);
  return (reportes || []).some(r =>
    r.status && r.status !== 'processed' && !/error|fail/i.test(r.status) &&
    Date.parse(r.begin_date) <= Date.parse(desde) && Date.parse(r.end_date) >= Date.parse(hasta)
  );
};

/**
 * Movimientos (de movimientosDelReporte) dentro de la ventana: un reporte puede cubrir más días
 */
export const movimientosEnVentana = (movimientos, { desde, hasta }) =>
  movimientos.filter(m => {
    const iso = fechaMangoAIso(m.fecha);
    return iso && iso >= desde && iso <= hasta;
  });
