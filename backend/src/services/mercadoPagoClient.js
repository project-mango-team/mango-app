import axios from 'axios';

// Cliente de solo lectura de la API de Mercado Pago (MP-01). Ver plans/mercadopago.md.
// El access token nunca aparece en errores ni en logs.

export const MP_API_URL = 'https://api.mercadopago.com';

// Máximo de días por reporte de liberaciones
export const MAX_DIAS_REPORTE = 60;

/**
 * Error de la API sin datos sensibles: método, ruta (sin query), status y el mensaje de MP
 */
export class MercadoPagoError extends Error {
  constructor(mensaje, status = null) {
    super(mensaje);
    this.name = 'MercadoPagoError';
    this.status = status;
  }
}

const describirError = (error, metodo, ruta) => {
  const status = error.response?.status ?? null;
  const detalle = error.response?.data?.message || error.response?.data?.error || error.code || error.message;
  if (status === 401 || status === 403) {
    return new MercadoPagoError('Mercado Pago rechazó el token: revisá que sea el access token de producción vigente', status);
  }
  return new MercadoPagoError(`Mercado Pago ${metodo} ${ruta.split('?')[0]}: ${status ?? 'sin respuesta'} ${detalle ?? ''}`.trim(), status);
};

/**
 * @param {string} accessToken - access token de producción (APP_USR-...)
 * @param {{ http?: { request: Function } }} opciones - `http` para tests (por defecto axios)
 */
export const crearClienteMercadoPago = (accessToken, { http = axios } = {}) => {
  if (!accessToken) {
    throw new MercadoPagoError('Falta el access token de Mercado Pago');
  }

  const llamar = async (metodo, ruta, { params, data, texto = false } = {}) => {
    try {
      const respuesta = await http.request({
        method: metodo,
        url: `${MP_API_URL}${ruta}`,
        params,
        data,
        timeout: 20000,
        headers: { Authorization: `Bearer ${accessToken}` },
        ...(texto && { responseType: 'text', transformResponse: [d => d] })
      });
      return { status: respuesta.status, data: respuesta.data };
    } catch (error) {
      throw describirError(error, metodo, ruta);
    }
  };

  return {
    /** Usuario dueño del token (id, nickname, site_id) */
    usuario: async () => (await llamar('GET', '/users/me')).data,

    /** Configuración del reporte de liberaciones, o null si nunca se creó */
    configReporte: async () => {
      try {
        return (await llamar('GET', '/v1/account/release_report/config')).data;
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },

    /** Crea (o actualiza, con `existente`) la configuración del reporte */
    guardarConfigReporte: async (config, { existente = false } = {}) =>
      (await llamar(existente ? 'PUT' : 'POST', '/v1/account/release_report/config', { data: config })).data,

    /**
     * Pide un reporte de liberaciones. Es asincrónico: aparece en listarReportes cuando está listo.
     * @param {Date|string} desde
     * @param {Date|string} hasta
     * @returns {Promise<boolean>} false si MP respondió 203 (no se creó, hay que reintentar)
     */
    pedirReporte: async (desde, hasta) => {
      const inicio = new Date(desde);
      const fin = new Date(hasta);
      if ((fin - inicio) / 86400000 > MAX_DIAS_REPORTE) {
        throw new MercadoPagoError(`El reporte de Mercado Pago cubre como máximo ${MAX_DIAS_REPORTE} días`);
      }
      const { status } = await llamar('POST', '/v1/account/release_report', {
        data: { begin_date: inicio.toISOString(), end_date: fin.toISOString() }
      });
      return status !== 203;
    },

    /** Reportes de liberaciones generados (con file_name, begin_date, end_date, status) */
    listarReportes: async () => (await llamar('GET', '/v1/account/release_report/list')).data ?? [],

    /** Contenido CSV de un reporte */
    descargarReporte: async (fileName) =>
      (await llamar('GET', `/v1/account/release_report/${encodeURIComponent(fileName)}`, { texto: true })).data,

    /** Búsqueda de pagos (devuelve { results, paging }) */
    buscarPagos: async (params) => (await llamar('GET', '/v1/payments/search', { params })).data,

    /** Detalle de un pago por id (el SOURCE_ID del reporte) */
    pago: async (id) => (await llamar('GET', `/v1/payments/${encodeURIComponent(id)}`)).data
  };
};

/**
 * Configuración del reporte que necesita el mapeo (utils/mercadoPagoMapping.js): encabezados en
 * inglés, "," como separador y las columnas que se usan
 */
export const CONFIG_REPORTE = {
  file_name_prefix: 'mango',
  display_timezone: 'GMT-03',
  report_translation: 'en',
  include_withdrawal_at_end: false,
  columns: ['DATE', 'SOURCE_ID', 'RECORD_TYPE', 'DESCRIPTION', 'NET_CREDIT_AMOUNT', 'NET_DEBIT_AMOUNT', 'BALANCE_AMOUNT', 'CURRENCY', 'PAYMENT_METHOD']
    .map(key => ({ key })),
  frequency: { hour: 6, type: 'daily', value: 1 }
};
