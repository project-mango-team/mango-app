// Sync de Mercado Pago de un usuario (MP-03): trae el reporte de liberaciones del período que falta
// y lo deja en la Bandeja como un CSV con el formato de MercadoPagoParser. Ver plans/mercadopago.md.
//
// Todo lo externo llega inyectado (token, estado, Bandeja, cliente), así se prueba sin Mongo ni MP.
// DEPS_REALES son las de producción (las usan el job y el botón de Configuración).

import Transaction from '../models/Transaction.js';
import IngestDocument from '../models/IngestDocument.js';
import { CONFIG_REPORTE, crearClienteMercadoPago } from './mercadoPagoClient.js';
import { leerSecreto } from './secretService.js';
import { recibirDocumento } from './ingestService.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { leerReporteLiberaciones, movimientosDelReporte, csvParaBandeja, nombreArchivoSync, saldoAlCierre, flujosNetosPorDia } from '../utils/mercadoPagoMapping.js';
import {
  ventanaSync, limitesReporte, reporteParaVentana, reporteEnPreparacion, movimientosEnVentana,
  fechaMangoAIso, periodoDeArchivoSync
} from '../utils/mercadoPagoSync.js';
import { SECRETO_MP } from './mercadoPagoCuentaService.js';
import { valuarSaldoMp } from './mercadoPagoSaldoService.js';

const reqDe = (userId) => ({ user: { _id: userId } });

/**
 * Hasta dónde está cargado Mercado Pago: el último movimiento importado (a mano o por la sync) y el
 * último período que la sync dejó en la Bandeja (aunque se haya descartado: no se vuelve a traer)
 */
export const estadoSyncDeUsuario = async (userId) => {
  const req = reqDe(userId);
  const fechas = await Transaction.find(buildUserQuery(req, { origen: 'Mercado Pago' })).select('fecha -_id').lean();
  const ultimaImportada = fechas.map(t => fechaMangoAIso(t.fecha)).filter(Boolean).sort().at(-1);
  const archivos = await IngestDocument.find(buildUserQuery(req, { fuente: 'api', filename: /^mercadopago-api-/ })).select('filename -_id').lean();
  const ultimaSync = archivos.map(d => periodoDeArchivoSync(d.filename)?.hasta).filter(Boolean).sort().at(-1);
  return {
    ultimaFechaImportada: ultimaImportada ? ultimaImportada.split('-').reverse().join('/') : null,
    ultimaSync: ultimaSync || null
  };
};

export const DEPS_REALES = {
  leerToken: (userId) => leerSecreto(userId, SECRETO_MP),
  estadoSync: estadoSyncDeUsuario,
  // reabrir: false → un período que el usuario descartó no vuelve a la Bandeja
  recibir: (userId, { buffer, filename }) => recibirDocumento(reqDe(userId), { buffer, filename, fuente: 'api', reabrir: false }),
  crearCliente: (token) => crearClienteMercadoPago(token),
  valuarSaldo: valuarSaldoMp
};

// Columnas sin las que el mapeo no funciona
const COLUMNAS_NECESARIAS = ['DATE', 'SOURCE_ID', 'RECORD_TYPE', 'DESCRIPTION', 'NET_CREDIT_AMOUNT', 'NET_DEBIT_AMOUNT', 'BALANCE_AMOUNT', 'CURRENCY'];

// El reporte tarda unos minutos: después de pedirlo se espera hasta ~3 minutos en la misma corrida
const ESPERAS = 6;
const ESPERA_MS = 30000;

/**
 * Deja la configuración del reporte con las columnas que usa el mapeo y encabezados en inglés.
 * Si el usuario ya tenía una configuración, conserva lo suyo y solo suma lo que falta.
 */
export const asegurarConfigReporte = async (mp) => {
  const actual = await mp.configReporte();
  if (!actual) {
    await mp.guardarConfigReporte(CONFIG_REPORTE);
    return 'creada';
  }
  const tiene = new Set((actual.columns || []).map(c => c.key));
  const faltan = COLUMNAS_NECESARIAS.filter(k => !tiene.has(k));
  if (!faltan.length && actual.report_translation === 'en') return 'ok';
  await mp.guardarConfigReporte({
    ...actual,
    report_translation: 'en',
    columns: [...(actual.columns || []), ...faltan.map(key => ({ key }))]
  }, { existente: true });
  return 'actualizada';
};

/**
 * Sincroniza un usuario. Idempotente: si ya está al día o el período ya está en la Bandeja, no hace nada.
 * @param {*} userId
 * @param {Object} deps
 * @param {(userId) => Promise<string|null>} deps.leerToken
 * @param {(userId) => Promise<{ ultimaFechaImportada: string|null, ultimaSync: string|null }>} deps.estadoSync
 * @param {(userId, { buffer, filename }) => Promise<{ existente: boolean }>} deps.recibir - a la Bandeja
 * @param {(token) => Object} deps.crearCliente
 * @param {(userId, { fecha, saldo, saldoInicial, desde, flujos }) => Promise<{ estado: string }>} [deps.valuarSaldo] - MP-04: saldo como valuación en Inversiones
 * @param {(ms) => Promise} [deps.esperar]
 * @param {number} [deps.esperas] - cuántas veces esperar el reporte recién pedido (0 desde la UI)
 * @param {Date} [deps.ahora]
 * @returns {Promise<{ estado: string, movimientos?: number, desde?: string, hasta?: string }>}
 *   estado: sin_token | al_dia | reporte_pedido | en_preparacion | sin_movimientos | en_bandeja | ya_estaba
 */
export const sincronizarUsuario = async (userId, deps = DEPS_REALES) => {
  const {
    leerToken, estadoSync, recibir, crearCliente, valuarSaldo,
    esperar = ms => new Promise(r => setTimeout(r, ms)), esperas = ESPERAS, ahora = new Date()
  } = deps;

  const token = await leerToken(userId);
  if (!token) return { estado: 'sin_token' };

  const ventana = ventanaSync({ ...(await estadoSync(userId)), ahora });
  if (!ventana) return { estado: 'al_dia' };

  const mp = crearCliente(token);
  let reportes = await mp.listarReportes();
  let elegido = reporteParaVentana(reportes, ventana);

  if (!elegido) {
    let estado = 'en_preparacion';
    if (!reporteEnPreparacion(reportes, ventana)) {
      await asegurarConfigReporte(mp);
      const { desde, hasta } = limitesReporte(ventana);
      if (!(await mp.pedirReporte(desde, hasta))) return { estado: 'reporte_pedido', ...ventana };
      estado = 'reporte_pedido';
    }
    for (let i = 0; i < esperas && !elegido; i++) {
      await esperar(ESPERA_MS);
      reportes = await mp.listarReportes();
      elegido = reporteParaVentana(reportes, ventana);
    }
    // Sigue en preparación: lo levanta la próxima corrida
    if (!elegido) return { estado, ...ventana };
  }

  const periodo = { desde: ventana.desde, hasta: elegido.hasta };
  const { movimientos, saldoInicial } = movimientosDelReporte(leerReporteLiberaciones(await mp.descargarReporte(elegido.reporte.file_name)));
  const enVentana = movimientosEnVentana(movimientos, periodo);

  // Saldo antes del primer movimiento: del saldo corrido, o el inicial del reporte si arranca en la ventana
  const primero = enVentana[0];
  const inicial = primero
    ? (primero.saldo !== null
      ? Math.round((primero.saldo - primero.monto) * 100) / 100
      : (movimientos[0] === primero ? saldoInicial : null))
    : null;

  // MP-04: el saldo al cierre del período queda como valuación (y lo que entró o salió, como aportes y
  // retiros). Si falla no frena la sync de movimientos.
  let saldo = null;
  if (valuarSaldo) {
    const monto = saldoAlCierre(movimientos, saldoInicial, periodo.hasta);
    if (monto !== null && monto >= 0) {
      try {
        const r = await valuarSaldo(userId, {
          fecha: periodo.hasta, saldo: monto, desde: periodo.desde, saldoInicial: inicial ?? monto,
          flujos: flujosNetosPorDia(enVentana)
        });
        if (r?.estado === 'guardada') saldo = monto;
      } catch (error) {
        console.error('MP-04: no se pudo valuar el saldo de Mercado Pago:', error.message);
      }
    }
  }

  if (!enVentana.length) return { estado: 'sin_movimientos', ...periodo, saldo };

  const csv = csvParaBandeja(enVentana, { saldoInicial: inicial });
  const { existente } = await recibir(userId, { buffer: Buffer.from(csv, 'utf-8'), filename: nombreArchivoSync(periodo.desde, periodo.hasta) });
  return { estado: existente ? 'ya_estaba' : 'en_bandeja', movimientos: enVentana.length, ...periodo, saldo };
};
