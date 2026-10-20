import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';
import { parseCoingecko } from '../utils/marketPrices.js';

// Precios públicos, sin login ni API key (con delay, alcanza para una valuación diaria):
// - Cripto: /simple/price de CoinGecko (plan público, con límite de pedidos por minuto).
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const CACHE_TTL_MS = 10 * 60 * 1000;
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
    console.warn(`Error fetching ${nombre} price:`, error.message);
    throw new AppError(`No se pudo traer el precio de ${nombre}. Probá de nuevo más tarde.`, 503);
  }
};

export class MarketPriceService {
  /**
   * Precio de una cripto en USD (y EUR si CoinGecko lo tiene)
   * @returns {Promise<{ usd: number, eur?: number }>}
   */
  static getCripto(id) {
    return conCache(`cripto:${id}`, async () =>
      parseCoingecko(await getJson(COINGECKO_URL, { ids: id, vs_currencies: 'usd,eur' }, 'CoinGecko'), id));
  }
}
