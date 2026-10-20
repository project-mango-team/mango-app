// Detección de transacciones ya cargadas (resúmenes que se superponen, el mismo archivo subido dos veces,
// el mismo resumen bajado del homebanking y de eresumen). Funciones puras.

/**
 * Fecha a DD/MM/YYYY (los parsers devuelven DD/MM/YYYY o DD-MM-YY)
 */
const normalizarFecha = (fecha) => {
  const partes = String(fecha ?? '').trim().replace(/-/g, '/').split('/');
  if (partes.length !== 3) return String(fecha ?? '').trim();
  const [d, m, y] = partes;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.length === 2 ? `20${y}` : y}`;
};

/**
 * Detalle comparable: mayúsculas, espacios simples y sin la marca de consumo (* o K) del principio.
 * La cuota ("Cuota 02/03") se mantiene: las cuotas de una misma compra comparten fecha y monto.
 */
export const normalizarDetalle = (detalle) =>
  String(detalle ?? '').toUpperCase().replace(/\s+/g, ' ').trim().replace(/^[*K] /, '');

/**
 * Huella de una transacción. En USD se usa el monto en dólares: el importe en pesos depende de la
 * cotización de cada import y cambiaría entre dos cargas del mismo resumen.
 */
export const huellaTransaccion = (t) => {
  const moneda = t.moneda || 'ARS';
  const monto = moneda === 'USD' ? t.monto_original : t.importe;
  return [
    normalizarFecha(t.fecha),
    t.tipo,
    moneda,
    Math.round(Math.abs(Number(monto) || 0) * 100),
    normalizarDetalle(t.detalle),
    t.origen ?? ''
  ].join('|');
};

/**
 * Marca qué transacciones nuevas ya existen. Compara contando repeticiones: dos cafés iguales el
 * mismo día se toman como dos si solo uno estaba cargado.
 * @param {Array} nuevas
 * @param {Array} existentes
 * @returns {boolean[]} duplicado por cada transacción nueva, en el mismo orden
 */
export const marcarTransaccionesDuplicadas = (nuevas, existentes) => {
  const disponibles = new Map();
  for (const t of existentes) {
    const h = huellaTransaccion(t);
    disponibles.set(h, (disponibles.get(h) || 0) + 1);
  }
  return nuevas.map(t => {
    const h = huellaTransaccion(t);
    const quedan = disponibles.get(h) || 0;
    if (quedan > 0) {
      disponibles.set(h, quedan - 1);
      return true;
    }
    return false;
  });
};

export { normalizarFecha };
