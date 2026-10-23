import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';
import { parseYahooChart, parseCoingecko } from '../utils/marketPrices.js';

// Precios públicos, sin login ni API key (con delay, alcanza para una valuación diaria):
// - Tickers: endpoint de gráficos de Yahoo Finance. CEDEARs y acciones locales con sufijo .BA (en pesos).
// - Cripto: /simple/price de CoinGecko (plan público, con límite de pedidos por minuto).
const YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const CACHE_TTL_MS = 10 * 60 * 1000;
// Yahoo rechaza pedidos sin un User-Agent de navegador
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Mango/1.0)' };

const cache = new Map();

const conCache = async (key, fetcher) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
  const data = await fetcher();
  cache.set(key, { data, fetchedAt: Date.now() });
  return data;
};

const getJson = async (url, params, nombre) => {
  try {
    const { data } = await axios.get(url, { params, headers: HEADERS, timeout: 10000 });
    return data;
  } catch (error) {
    // Yahoo responde 404 a un ticker que no existe: lo deja decidir al parser
    if (error.response?.status === 404) return error.response.data;
    console.warn(`Error fetching ${nombre} price:`, error.message);
    throw new AppError(`No se pudo traer el precio de ${nombre}. Probá de nuevo más tarde.`, 503);
  }
};

export class MarketPriceService {
  /**
   * Último precio de un ticker en su moneda de cotización
   * @returns {Promise<{ precio: number, moneda: string, fecha: string }>}
   */
  static getTicker(ticker) {
    return conCache(`ticker:${ticker}`, async () =>
      parseYahooChart(await getJson(`${YAHOO_URL}/${encodeURIComponent(ticker)}`, { range: '5d', interval: '1d' }, 'Yahoo Finance'), ticker));
  }

  /**
   * Precio de una cripto en USD (y EUR si CoinGecko lo tiene)
   * @returns {Promise<{ usd: number, eur?: number }>}
   */
  static getCripto(id) {
    return conCache(`cripto:${id}`, async () =>
      parseCoingecko(await getJson(COINGECKO_URL, { ids: id, vs_currencies: 'usd,eur' }, 'CoinGecko'), id));
  }
}
