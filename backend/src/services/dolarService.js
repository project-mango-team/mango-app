import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = null;

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
}
