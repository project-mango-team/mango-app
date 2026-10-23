import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';
import { CATEGORIAS_FCI } from '../utils/investmentValuation.js';
import { filaAFondo, buscarFondos, encontrarFondo } from '../utils/fciPrices.js';

// Valores de cuotaparte de FCI del reporte diario de la CAFCI.
// La API de la CAFCI (api.cafci.org.ar) rechaza pedidos que no vienen de su web, así que se usa
// argentinadatos.com, que publica el mismo reporte por categoría, sin login ni API key.
const BASE_URL = 'https://api.argentinadatos.com/v1/finanzas/fci';
const CACHE_TTL_MS = 60 * 60 * 1000;

// `${categoria}:${dia}` → { data, fetchedAt }  (dia = 'ultimo' | 'penultimo')
const cache = new Map();

const getReporte = async (categoria, dia = 'ultimo') => {
  const key = `${categoria}:${dia}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const { data: raw } = await axios.get(`${BASE_URL}/${categoria}/${dia}`, { timeout: 15000 });
  if (!Array.isArray(raw)) throw new Error(`Respuesta inesperada para ${key}`);
  const data = raw.map(fila => filaAFondo(fila, categoria));
  cache.set(key, { data, fetchedAt: Date.now() });
  return data;
};

/**
 * Todos los fondos de todas las categorías (el último día publicado). Ignora las categorías que fallan.
 */
const getTodos = async () => {
  const resultados = await Promise.allSettled(CATEGORIAS_FCI.map(c => getReporte(c)));
  const ok = resultados.filter(r => r.status === 'fulfilled');
  if (ok.length === 0) {
    console.warn('Error fetching FCI prices:', resultados[0].reason?.message);
    throw new AppError('No se pudieron traer los fondos de la CAFCI. Probá de nuevo más tarde.', 503);
  }
  return ok.flatMap(r => r.value);
};

export class FciService {
  /**
   * Fondos cuyo nombre contiene las palabras buscadas, con su último valor de cuotaparte
   */
  static async buscar(consulta) {
    return buscarFondos(await getTodos(), consulta);
  }

  /**
   * Último valor de UNA cuotaparte del fondo y clase configurados en el activo.
   * Si el fondo no informó el último día, usa el anterior; si no está en su categoría, lo busca en todas.
   * @param {{ fci_nombre: string, fci_categoria: string }} config
   * @returns {Promise<{ precio: number, fecha: string, fuente: string }>}
   */
  static async getPrecio({ fci_nombre, fci_categoria }) {
    const intentos = [
      () => getReporte(fci_categoria, 'ultimo'),
      () => getReporte(fci_categoria, 'penultimo'),
      getTodos
    ];
    let error = null;
    for (const intento of intentos) {
      try {
        const fondo = encontrarFondo(await intento(), fci_nombre);
        if (fondo) return { precio: fondo.precio, fecha: fondo.fecha, fuente: 'CAFCI' };
      } catch (e) {
        error = e;
      }
    }
    if (error) {
      console.warn('Error fetching FCI price:', error.message);
      throw new AppError('No se pudo traer el valor de la cuotaparte de la CAFCI. Probá de nuevo más tarde.', 503);
    }
    throw new AppError(`No se encontró "${fci_nombre}" en la CAFCI. Revisá el fondo en Editar datos.`, 404);
  }
}
