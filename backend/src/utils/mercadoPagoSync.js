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

// Un reporte sirve si arranca a más tardar en `desde` y cubre al menos ese día
const cubreElInicio = (r, { desde }) => {
  const inicio = Date.parse(limitesReporte({ desde, hasta: desde }).desde);
  return Date.parse(r.begin_date) <= inicio && Date.parse(r.end_date) > inicio;
};

// Último día (en Argentina) que cubre un reporte: su end_date menos un segundo
const ultimoDiaDelReporte = (r) => isoArgentina(new Date(Date.parse(r.end_date) - 1000));

/**
 * Reporte ya generado para traer la ventana. Puede cubrirla solo en parte: un reporte pedido ayer
 * termina antes que la ventana de hoy, así que se trae hasta donde llega y la sync siguiente sigue
 * desde ahí. Entre los que sirven, el que llega más lejos.
 * @param {Object[]} reportes - salida de listarReportes ({ file_name, begin_date, end_date, status })
 * @returns {{ reporte: Object, hasta: string }|null} hasta: YYYY-MM-DD, el último día a importar
 */
export const reporteParaVentana = (reportes, ventana) => {
  const reporte = (reportes || [])
    .filter(r => r.file_name && (!r.status || r.status === 'processed'))
    .filter(r => cubreElInicio(r, ventana))
    .sort((a, b) => Date.parse(b.end_date) - Date.parse(a.end_date))[0];
  if (!reporte) return null;
  const ultimo = ultimoDiaDelReporte(reporte);
  return { reporte, hasta: ultimo < ventana.hasta ? ultimo : ventana.hasta };
};

/**
 * ¿Hay un reporte para la ventana pedido y todavía en preparación? Para no pedirlo de nuevo.
 */
export const reporteEnPreparacion = (reportes, ventana) =>
  (reportes || []).some(r =>
    r.status && r.status !== 'processed' && !/error|fail/i.test(r.status) && cubreElInicio(r, ventana)
  );

/**
 * Período de un archivo armado por la sync (nombreArchivoSync), o null si no es uno
 * @returns {{ desde: string, hasta: string }|null}
 */
export const periodoDeArchivoSync = (filename) => {
  const m = String(filename ?? '').match(/^mercadopago-api-(\d{4}-\d{2}-\d{2})-a-(\d{4}-\d{2}-\d{2})\.csv$/);
  return m ? { desde: m[1], hasta: m[2] } : null;
};

/**
 * Movimientos (de movimientosDelReporte) dentro de la ventana: un reporte puede cubrir más días
 */
export const movimientosEnVentana = (movimientos, { desde, hasta }) =>
  movimientos.filter(m => {
    const iso = fechaMangoAIso(m.fecha);
    return iso && iso >= desde && iso <= hasta;
  });

const diaMes = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

/**
 * Aviso para el usuario según el resultado de su sync (notificationService.notificar), o null si no
 * hay nada que contar. La clave evita avisar dos veces lo mismo (reintentos, "Correr ahora").
 * @param {{ estado, movimientos?, desde?, hasta?, status?, mensaje? }} resultado
 * @param {string} dia - YYYY-MM-DD de la corrida
 */
export const avisoDeSync = (resultado, dia) => {
  const { estado, movimientos, desde, hasta } = resultado;
  if (estado === 'en_bandeja') {
    return {
      tipo: 'mercadopago_sync',
      nivel: 'info',
      titulo: 'Movimientos de Mercado Pago en la Bandeja',
      mensaje: `${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'} del ${diaMes(desde)} al ${diaMes(hasta)}, listos para revisar.`,
      link: '/bandeja',
      clave: `mp-sync:${desde}:${hasta}`
    };
  }
  if (estado !== 'error') return null;
  if (resultado.status === 401 || resultado.status === 403) {
    return {
      tipo: 'mercadopago_sync',
      nivel: 'error',
      titulo: 'Mercado Pago rechazó el token',
      mensaje: 'Mango no puede traer tus movimientos: cargá un access token nuevo en Configuración.',
      link: '/configuracion',
      clave: `mp-token:${dia}`
    };
  }
  return {
    tipo: 'mercadopago_sync',
    nivel: 'alerta',
    titulo: 'No se pudieron traer los movimientos de Mercado Pago',
    mensaje: `${resultado.mensaje || 'Error desconocido'}. Se reintenta en la próxima corrida.`,
    link: '/configuracion',
    clave: `mp-error:${dia}`
  };
};

/**
 * Texto para la UI con el resultado de una sync manual
 */
export const mensajeDeSync = ({ estado, movimientos, desde, hasta }) => ({
  sin_token: 'No hay una cuenta de Mercado Pago conectada.',
  al_dia: 'Ya está todo traído hasta ayer.',
  reporte_pedido: 'Le pedimos el reporte a Mercado Pago. Tarda unos minutos: volvé a intentar en un rato o esperá la sincronización diaria.',
  en_preparacion: 'Mercado Pago todavía está preparando el reporte. Volvé a intentar en unos minutos.',
  sin_movimientos: desde ? `No hubo movimientos del ${diaMes(desde)} al ${diaMes(hasta)}.` : 'No hubo movimientos nuevos.',
  en_bandeja: desde ? `${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'} del ${diaMes(desde)} al ${diaMes(hasta)} en la Bandeja.` : 'Movimientos en la Bandeja.',
  ya_estaba: 'Ese período ya estaba en la Bandeja.'
}[estado] || 'Sincronización terminada.');
