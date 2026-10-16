import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

// Cotizaciones para inversiones: las de hoy vencen con CACHE_TTL_MS, las de días pasados no cambian
const cotizacionesHoy = new Map();
const cotizacionesHistoricas = new Map();

const ENDPOINTS_INVERSION = {
  blue: {
    actual: 'https://dolarapi.com/v1/dolares/blue',
    historico: 'https://api.argentinadatos.com/v1/cotizaciones/dolares/blue'
  },
  eur: {
    actual: 'https://dolarapi.com/v1/cotizaciones/eur',
    historico: 'https://api.argentinadatos.com/v1/cotizaciones/eur'
  }
};

/**
 * Fecha de hoy en Argentina como YYYY-MM-DD
 * @returns {string}
 */
export const hoyArgentina = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * Service to get dollar exchange rates
 * Uses the "oficial" sell rate: card USD balances paid with own dollars
 * (stop debit) don't carry the 30% percepción, so dólar tarjeta doesn't apply.
 */
export class DolarService {
  /**
   * Get current dollar "oficial" sell rate with its source and update time
   * @returns {Promise<{ casa: string, venta: number, fuente: string, fechaActualizacion: string }>}
   */
  static async getCotizacionDetalle() {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache.data;
    }

    const fuentes = [DolarService.fromDolarApi, DolarService.fromBluelytics];
    for (const fuente of fuentes) {
      try {
        const data = await fuente();
        if (data.venta > 0) {
          cache = { data, fetchedAt: Date.now() };
          return data;
        }
      } catch (error) {
        console.warn(`Error fetching dollar rate from ${fuente.name}:`, error.message);
      }
    }

    throw new AppError('No se pudo obtener la cotización del dólar. Ingresala manualmente.', 503);
  }

  /**
   * Get current dollar "oficial" sell rate
   * @returns {Promise<number>}
   */
  static async getCotizacion() {
    const { venta } = await DolarService.getCotizacionDetalle();
    return venta;
  }

  static async fromDolarApi() {
    const { data } = await axios.get('https://dolarapi.com/v1/dolares/oficial', { timeout: 3000 });
    return {
      casa: 'oficial',
      venta: parseFloat(data.venta),
      fuente: 'dolarapi.com',
      fechaActualizacion: data.fechaActualizacion
    };
  }

  static async fromBluelytics() {
    const { data } = await axios.get('https://api.bluelytics.com.ar/v2/latest', { timeout: 3000 });
    return {
      casa: 'oficial',
      venta: parseFloat(data.oficial?.value_sell),
      fuente: 'bluelytics.com.ar',
      fechaActualizacion: data.last_update
    };
  }

  /**
   * Dólar blue (ARS por USD) usado para valuar inversiones
   * @param {string} [fecha] - YYYY-MM-DD; sin fecha o con fecha de hoy trae la actual
   * @returns {Promise<{ casa: string, compra: number, venta: number, promedio: number, fecha: string, fuente: string }>}
   */
  static async getBlue(fecha) {
    return DolarService.getCotizacionInversion('blue', fecha);
  }

  /**
   * Euro oficial (ARS por EUR) usado para valuar inversiones
   * @param {string} [fecha] - YYYY-MM-DD; sin fecha o con fecha de hoy trae la actual
   */
  static async getEuro(fecha) {
    return DolarService.getCotizacionInversion('eur', fecha);
  }

  static async getCotizacionInversion(casa, fecha) {
    const hoy = hoyArgentina();
    const esHoy = !fecha || fecha >= hoy;
    const dia = esHoy ? hoy : fecha;
    const key = `${casa}:${dia}`;

    if (esHoy) {
      const cached = cotizacionesHoy.get(casa);
      if (cached && cached.data.fecha === hoy && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    } else if (cotizacionesHistoricas.has(key)) {
      return cotizacionesHistoricas.get(key);
    }

    const { actual, historico } = ENDPOINTS_INVERSION[casa];
    const [y, m, d] = dia.split('-');
    const urls = esHoy ? [actual, `${historico}/${y}/${m}/${d}`] : [`${historico}/${y}/${m}/${d}`];

    for (const url of urls) {
      try {
        const { data: raw } = await axios.get(url, { timeout: 5000 });
        const compra = parseFloat(raw.compra);
        const venta = parseFloat(raw.venta);
        if (!(compra > 0 && venta > 0)) continue;

        const data = {
          casa,
          compra,
          venta,
          promedio: (compra + venta) / 2,
          fecha: dia,
          fuente: new URL(url).hostname
        };
        if (esHoy) {
          cotizacionesHoy.set(casa, { data, fetchedAt: Date.now() });
        } else {
          cotizacionesHistoricas.set(key, data);
        }
        return data;
      } catch (error) {
        console.warn(`Error fetching ${casa} rate from ${url}:`, error.message);
      }
    }

    const nombre = casa === 'eur' ? 'del euro' : 'del dólar blue';
    throw new AppError(`No se pudo obtener la cotización ${nombre} para el ${dia}. Ingresala manualmente.`, 503);
  }
}
