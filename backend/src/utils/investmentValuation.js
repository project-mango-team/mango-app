// Valuación automática de inversiones: unidades en tenencia y fuente de precio de cada activo.
// Funciones puras: no tocan la DB ni la red.
import { AppError } from '../middleware/errorHandler.js';
import { FUENTES_PRECIO } from '../models/InvestmentAsset.js';
import { ordenarMovimientos } from './investmentCalc.js';

export const CATEGORIAS_FCI = ['mercadoDinero', 'rentaFija', 'rentaVariable', 'rentaMixta', 'otros'];

const EPSILON = 1e-9;
const redondearUnidades = (n) => Math.round(n * 1e8) / 1e8;
const tieneUnidades = (mov) => typeof mov.unidades === 'number' && Number.isFinite(mov.unidades);

/**
 * Unidades en tenencia de un activo (cuotapartes, acciones, BTC...).
 * Si algún movimiento trae unidades, salen de los movimientos en orden cronológico:
 * una Valuación con unidades fija la tenencia, un Aporte suma y un Retiro resta.
 * Si ninguno trae, se usan las unidades cargadas a mano en el activo.
 * @param {{ unidades?: number }} activo
 * @param {Array<{ tipo: string, fecha: Date|string, unidades?: number }>} movimientos
 * @returns {{ unidades: number|null, origen: 'movimientos'|'manual'|null, incompletas: boolean }}
 *   incompletas: hay aportes o retiros posteriores al primer dato de unidades que no las traen
 */
export const calcularUnidades = (activo, movimientos) => {
  const ordenados = ordenarMovimientos(movimientos);
  const primero = ordenados.findIndex(tieneUnidades);

  if (primero === -1) {
    const manual = tieneUnidades(activo) ? activo.unidades : null;
    return { unidades: manual, origen: manual === null ? null : 'manual', incompletas: false };
  }

  let unidades = 0;
  // Aportes o retiros sin unidades antes del primer dato: la cuenta arranca incompleta
  let incompletas = ordenados.slice(0, primero).some(m => m.tipo !== 'Valuacion');
  for (const mov of ordenados.slice(primero)) {
    if (!tieneUnidades(mov)) {
      if (mov.tipo !== 'Valuacion') incompletas = true;
      continue;
    }
    if (mov.tipo === 'Valuacion') {
      unidades = mov.unidades;
      incompletas = false;
    } else if (mov.tipo === 'Aporte') {
      unidades += mov.unidades;
    } else if (mov.tipo === 'Retiro') {
      unidades -= mov.unidades;
    }
  }

  return { unidades: Math.abs(unidades) < EPSILON ? 0 : redondearUnidades(unidades), origen: 'movimientos', incompletas };
};

/**
 * Unidades opcionales de un input: undefined si no vino, null para borrarlas
 */
export const parseUnidades = (valor) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError('Las unidades deben ser un número mayor o igual a 0', 400);
  }
  return n;
};

const textoRequerido = (valor, mensaje) => {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) throw new AppError(mensaje, 400);
  return texto;
};

/**
 * Valida la fuente de precio y se queda solo con los parámetros que esa fuente usa
 * @returns {{ fuente_precio: string, precio_config: Object }}
 */
export const normalizarFuentePrecio = (fuente = 'manual', config = {}) => {
  if (!FUENTES_PRECIO.includes(fuente)) {
    throw new AppError(`Fuente de precio inválida. Opciones: ${FUENTES_PRECIO.join(', ')}`, 400);
  }
  const c = config && typeof config === 'object' ? config : {};

  switch (fuente) {
    case 'cafci': {
      const fci_nombre = textoRequerido(c.fci_nombre, 'Elegí el fondo y la clase de la CAFCI');
      if (!CATEGORIAS_FCI.includes(c.fci_categoria)) {
        throw new AppError(`Categoría de FCI inválida. Opciones: ${CATEGORIAS_FCI.join(', ')}`, 400);
      }
      return { fuente_precio: fuente, precio_config: { fci_nombre, fci_categoria: c.fci_categoria } };
    }
    case 'ticker':
      return {
        fuente_precio: fuente,
        precio_config: { ticker: textoRequerido(c.ticker, 'Ingresá el ticker').toUpperCase() }
      };
    case 'coingecko':
      return {
        fuente_precio: fuente,
        precio_config: { coingecko_id: textoRequerido(c.coingecko_id, 'Ingresá el id de CoinGecko').toLowerCase() }
      };
    case 'tasa_fija': {
      const tasa = Number(c.tasa_anual);
      if (c.tasa_anual === '' || c.tasa_anual === null || !Number.isFinite(tasa) || tasa < 0 || tasa > 1000) {
        throw new AppError('La tasa anual debe ser un porcentaje entre 0 y 1000', 400);
      }
      return { fuente_precio: fuente, precio_config: { tasa_anual: tasa } };
    }
    default:
      return { fuente_precio: 'manual', precio_config: {} };
  }
};
