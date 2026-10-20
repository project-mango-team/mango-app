// Precios de mercado para la valuación automática: cripto (CoinGecko).
// Funciones puras: no tocan la red.
import { AppError } from '../middleware/errorHandler.js';

const MONEDAS = ['ARS', 'USD', 'EUR'];

/**
 * Precio de una moneda en la respuesta de /simple/price de CoinGecko
 * @returns {{ usd: number, eur?: number }}
 */
export const parseCoingecko = (raw, id) => {
  const fila = raw?.[id];
  const usd = Number(fila?.usd);
  if (!(usd > 0)) {
    throw new AppError(`No se encontró "${id}" en CoinGecko. Usá el id de la moneda (ej: bitcoin, ethereum, tether)`, 404);
  }
  const eur = Number(fila.eur);
  return eur > 0 ? { usd, eur } : { usd };
};

/**
 * Pasa un precio de una moneda a otra con las cotizaciones del día (ARS por USD y ARS por EUR)
 * @param {number} precio
 * @param {string} de
 * @param {string} a
 * @param {{ usd: number, eur?: number }} cot
 */
export const convertirPrecio = (precio, de, a, cot) => {
  if (!MONEDAS.includes(de)) throw new AppError(`El precio viene en ${de || 'una moneda desconocida'}, que Mango no convierte`, 400);
  if (de === a) return precio;
  const arsPor = { ARS: 1, USD: cot.usd, EUR: cot.eur };
  if (!(arsPor[de] > 0) || !(arsPor[a] > 0)) throw new AppError('Falta la cotización para convertir el precio', 503);
  return (precio * arsPor[de]) / arsPor[a];
};
