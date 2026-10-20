import InvestmentAsset from '../models/InvestmentAsset.js';
import InvestmentMovement from '../models/InvestmentMovement.js';
import { AppError } from '../middleware/errorHandler.js';
import { FciService } from './fciService.js';
import { DolarService } from './dolarService.js';
import { calcularValuacionPorPrecio, calcularUnidades } from '../utils/investmentValuation.js';
import { convertirMonto } from '../utils/investmentCalc.js';

// Valuación automática de activos según su fuente de precio (VAL).
// Todo se filtra por el user_id del activo, así sirve tanto desde un request como desde un job.

// Fuentes que ya traen precio (las demás llegan con VAL-04 a VAL-06)
export const FUENTES_AUTOMATICAS = ['cafci'];

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

/**
 * Valúa una lista de activos con su fuente de precio. Las dependencias se inyectan para poder testearlo.
 * Un error de un activo no corta los demás: se cuenta y se sigue.
 * @param {Array} activos
 * @param {{
 *   movimientosDe: (asset) => Promise<Array>,
 *   calcular: (asset, movimientos) => Promise<{ fecha: string }>,
 *   cotizaciones: (fecha: string, moneda: string) => Promise<{ usd: number, eur?: number }>,
 *   guardar: (asset, valuacion, cot) => Promise<{ estado: string }>
 * }} deps
 * @returns {Promise<{ resumen: { activos, guardadas, omitidas, sin_unidades, errores }, errores: Array<{ asset_id, status, mensaje }> }>}
 */
export const valuarActivos = async (activos, { movimientosDe, calcular, cotizaciones, guardar }) => {
  const resumen = { activos: activos.length, guardadas: 0, omitidas: 0, sin_unidades: 0, errores: 0 };
  const errores = [];

  for (const asset of activos) {
    try {
      const movimientos = await movimientosDe(asset);
      // Sin unidades o vendido del todo (0 unidades): no hay nada que valuar
      const { unidades } = calcularUnidades(asset, movimientos);
      if (!(unidades > 0)) {
        resumen.sin_unidades++;
        continue;
      }
      const valuacion = await calcular(asset, movimientos);
      const cot = await cotizaciones(valuacion.fecha, asset.moneda);
      const { estado } = await guardar(asset, valuacion, cot);
      resumen[estado === 'guardada' ? 'guardadas' : 'omitidas']++;
    } catch (error) {
      resumen.errores++;
      errores.push({ asset_id: String(asset._id), status: error.statusCode || 500, mensaje: error.message });
    }
  }
  return { resumen, errores };
};

/**
 * Cotizaciones por fecha con memo, para no pedir la misma fecha una vez por activo
 */
const crearCotizaciones = () => {
  const memo = new Map();
  return (fecha, moneda) => {
    const key = `${fecha}:${moneda === 'EUR' ? 'eur' : 'usd'}`;
    if (!memo.has(key)) {
      memo.set(key, (async () => {
        const usd = (await DolarService.getBlue(fecha)).promedio;
        return moneda === 'EUR' ? { usd, eur: (await DolarService.getEuro(fecha)).promedio } : { usd };
      })());
    }
    return memo.get(key);
  };
};

/**
 * Valuación diaria de todos los activos con fuente automática, de todos los usuarios (job VAL-03)
 */
export const valuarTodos = async () => {
  const activos = await InvestmentAsset.find({ fuente_precio: { $in: FUENTES_AUTOMATICAS } });
  return valuarActivos(activos, {
    movimientosDe: (asset) => InvestmentMovement.find({ user_id: asset.user_id, asset_id: asset._id }).lean(),
    calcular: calcularValuacionAutomatica,
    cotizaciones: crearCotizaciones(),
    guardar: guardarValuacionAutomatica
  });
};
