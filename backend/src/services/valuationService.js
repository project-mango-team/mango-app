import InvestmentMovement from '../models/InvestmentMovement.js';
import { AppError } from '../middleware/errorHandler.js';
import { FciService } from './fciService.js';
import { calcularValuacionPorPrecio } from '../utils/investmentValuation.js';
import { convertirMonto } from '../utils/investmentCalc.js';

// Valuación automática de activos según su fuente de precio (VAL).
// Todo se filtra por el user_id del activo, así sirve tanto desde un request como desde un job.

/**
 * Precio de UNA unidad del activo en su moneda, según su fuente
 * @returns {Promise<{ precio: number, fecha: string, fuente: string }>}
 */
export const obtenerPrecio = async (asset) => {
  switch (asset.fuente_precio) {
    case 'cafci':
      return FciService.getPrecio(asset.precio_config || {});
    case 'manual':
    case undefined:
      throw new AppError('El activo no tiene una fuente de precio automática', 400);
    default:
      throw new AppError('Esa fuente de precio todavía no está disponible', 501);
  }
};

/**
 * Calcula (sin guardar) la valuación automática del activo con el último precio de su fuente
 * @returns {Promise<{ fecha: string, precio: number, unidades: number, monto: number, fuente: string }>}
 */
export const calcularValuacionAutomatica = async (asset, movimientos) => {
  const cotizacion = await obtenerPrecio(asset);
  return { ...calcularValuacionPorPrecio(asset, movimientos, cotizacion), fuente: cotizacion.fuente };
};

const numeroAR = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 8 });

const filtroDelDia = (asset, fecha) => ({
  user_id: asset.user_id,
  asset_id: asset._id,
  tipo: 'Valuacion',
  fecha: new Date(`${fecha}T00:00:00Z`)
});

/**
 * Guarda la valuación automática del día. Reemplaza la automática que ya hubiera ese día
 * y no hace nada si el usuario cargó una valuación manual esa fecha.
 * @param {Object} asset - InvestmentAsset (con user_id)
 * @param {{ fecha: string, precio: number, unidades: number, monto: number, fuente: string }} valuacion
 * @param {{ usd: number, eur?: number }} cot - cotizaciones de la fecha de la valuación
 * @returns {Promise<{ estado: 'guardada'|'omitida', movimiento?: Object, motivo?: string }>}
 */
export const guardarValuacionAutomatica = async (asset, valuacion, cot) => {
  const filtro = filtroDelDia(asset, valuacion.fecha);
  const manual = await InvestmentMovement.exists({ ...filtro, automatica: { $ne: true } });
  if (manual) {
    return { estado: 'omitida', motivo: 'Ya hay una valuación manual ese día' };
  }

  const movimiento = await InvestmentMovement.findOneAndUpdate(
    { ...filtro, automatica: true },
    {
      $set: {
        monto: valuacion.monto,
        cotizacion_usd: cot.usd,
        ...(asset.moneda === 'EUR' && { cotizacion_eur: cot.eur }),
        ...convertirMonto(valuacion.monto, asset.moneda, cot),
        notas: `Automática · ${valuacion.fuente}: ${numeroAR(valuacion.unidades)} × ${numeroAR(valuacion.precio)}`
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
  return { estado: 'guardada', movimiento };
};
