import InvestmentAsset from '../models/InvestmentAsset.js';
import InvestmentMovement from '../models/InvestmentMovement.js';
import { AppError } from '../middleware/errorHandler.js';
import { FciService } from './fciService.js';
import { MarketPriceService } from './marketPriceService.js';
import { convertirPrecio } from '../utils/marketPrices.js';
import { DolarService, hoyArgentina } from './dolarService.js';
import { calcularValuacionPorPrecio, calcularUnidades, devengarTasaFija } from '../utils/investmentValuation.js';
import { convertirMonto } from '../utils/investmentCalc.js';

// Valuación automática de activos según su fuente de precio (VAL).
// Todo se filtra por el user_id del activo, así sirve tanto desde un request como desde un job.

// Fuentes que ya valúan solas (los tickers llegan con VAL-04)
export const FUENTES_AUTOMATICAS = ['cafci', 'coingecko', 'tasa_fija'];

/**
 * Precio de una cripto en la moneda del activo: USD o EUR directo de CoinGecko, ARS al dólar blue de hoy
 */
const precioCripto = async (asset) => {
  const { usd, eur } = await MarketPriceService.getCripto(asset.precio_config?.coingecko_id);
  const fecha = hoyArgentina();
  if (asset.moneda === 'EUR' && eur) return { precio: eur, fecha, fuente: 'CoinGecko' };
  const cot = asset.moneda === 'USD' ? { usd: 1 } : await cotizacionesHoy(asset.moneda);
  return { precio: convertirPrecio(usd, 'USD', asset.moneda, cot), fecha, fuente: 'CoinGecko' };
};

const cotizacionesHoy = async (moneda) => {
  const usd = (await DolarService.getBlue()).promedio;
  return moneda === 'EUR' ? { usd, eur: (await DolarService.getEuro()).promedio } : { usd };
};

/**
 * Precio de UNA unidad del activo en su moneda, según su fuente
 * @returns {Promise<{ precio: number, fecha: string, fuente: string }>}
 */
export const obtenerPrecio = async (asset) => {
  switch (asset.fuente_precio) {
    case 'cafci':
      return FciService.getPrecio(asset.precio_config || {});
    case 'coingecko':
      return precioCripto(asset);
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
  // Tasa fija: sin precio ni unidades, se devenga el interés hasta hoy
  if (asset.fuente_precio === 'tasa_fija') {
    const fecha = hoyArgentina();
    const tasa = asset.precio_config?.tasa_anual;
    return { fecha, precio: null, unidades: null, monto: devengarTasaFija(movimientos, tasa, fecha), fuente: 'Tasa fija', tasa_anual: tasa };
  }
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
        // Ahora: así queda después de los movimientos de ese día que ya incluye y antes de los que se carguen después
        created_at: new Date(),
        cotizacion_usd: cot.usd,
        ...(asset.moneda === 'EUR' && { cotizacion_eur: cot.eur }),
        ...convertirMonto(valuacion.monto, asset.moneda, cot),
        notas: valuacion.unidades == null
          ? `Automática · ${valuacion.fuente} ${numeroAR(valuacion.tasa_anual)}% anual`
          : `Automática · ${valuacion.fuente}: ${numeroAR(valuacion.unidades)} × ${numeroAR(valuacion.precio)}`
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
 * @returns {Promise<{ resumen: { activos, guardadas, omitidas, sin_tenencia, errores }, errores: Array<{ asset_id, status, mensaje }> }>}
 */
export const valuarActivos = async (activos, { movimientosDe, calcular, cotizaciones, guardar }) => {
  const resumen = { activos: activos.length, guardadas: 0, omitidas: 0, sin_tenencia: 0, errores: 0 };
  const errores = [];

  for (const asset of activos) {
    try {
      const movimientos = await movimientosDe(asset);
      // Sin unidades o vendido del todo (0 unidades): no hay nada que valuar. Tasa fija no usa unidades.
      if (asset.fuente_precio !== 'tasa_fija' && !(calcularUnidades(asset, movimientos).unidades > 0)) {
        resumen.sin_tenencia++;
        continue;
      }
      const valuacion = await calcular(asset, movimientos);
      // Activo cerrado (valor 0): no se le agregan valuaciones
      if (!(valuacion.monto > 0)) {
        resumen.sin_tenencia++;
        continue;
      }
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
