import { claveComercio } from './reviewFocus.js';

// Sugerencias de categoría con IA (REV-06): lo que no cubrió ninguna regla se manda a Claude Haiku
// con ejemplos del historial. Funciones puras: armado del pedido y validación de la respuesta.

export const MAX_TRANSACCIONES = 40;
export const MAX_EJEMPLOS = 80;
const MAX_DETALLE = 120;

export const SISTEMA = [
  'Clasificás movimientos bancarios de una persona en Argentina en una de sus categorías.',
  'Te paso las categorías, ejemplos de cómo clasificó la persona movimientos anteriores y los movimientos a clasificar.',
  'Para cada movimiento devolvé la categoría más probable y tu confianza entre 0 y 1.',
  'Si no hay forma razonable de saberlo (por ejemplo, una transferencia a una persona sin más datos), usá confianza baja.',
  'Usá solo las categorías de la lista.'
].join(' ');

const recortar = (texto) => String(texto || '').replace(/\s+/g, ' ').trim().slice(0, MAX_DETALLE);

/**
 * Ejemplos del historial: por comercio (patrón del detalle), la categoría que más usó la persona.
 * Primero los comercios más frecuentes. Sin "Otros" ni categorías que ya no existen.
 */
export const armarEjemplos = (historial, categorias, max = MAX_EJEMPLOS) => {
  const validas = new Set(categorias.filter(c => c !== 'Otros'));
  const porComercio = new Map();
  for (const t of historial) {
    if (!validas.has(t.categoria)) continue;
    const clave = claveComercio(t.detalle);
    if (!clave) continue;
    if (!porComercio.has(clave)) porComercio.set(clave, new Map());
    const cuenta = porComercio.get(clave);
    cuenta.set(t.categoria, (cuenta.get(t.categoria) || 0) + 1);
  }
  return [...porComercio.entries()]
    .map(([comercio, cuenta]) => {
      const [categoria, veces] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
      const total = [...cuenta.values()].reduce((s, n) => s + n, 0);
      return { detalle: recortar(comercio), categoria, total, veces };
    })
    .sort((a, b) => b.total - a.total || a.detalle.localeCompare(b.detalle))
    .slice(0, max)
    .map(({ detalle, categoria }) => ({ detalle, categoria }));
};

/**
 * Lo que se manda de cada movimiento: solo detalle, monto, tipo y origen (nada que identifique a la persona)
 */
export const prepararTransacciones = (transacciones) => (Array.isArray(transacciones) ? transacciones : [])
  .filter(t => Number.isInteger(t?.id) && String(t?.detalle || '').trim())
  .slice(0, MAX_TRANSACCIONES)
  .map(t => ({
    id: t.id,
    detalle: recortar(t.detalle),
    importe: Math.round((Number(t.importe) || 0) * 100) / 100,
    tipo: t.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
    origen: recortar(t.origen)
  }));

export const armarMensaje = ({ categorias, ejemplos, transacciones }) => JSON.stringify({
  categorias,
  ejemplos,
  movimientos: transacciones
});

export const esquemaRespuesta = (categorias) => ({
  type: 'object',
  properties: {
    sugerencias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          categoria: { type: 'string', enum: categorias },
          confianza: { type: 'number' }
        },
        required: ['id', 'categoria', 'confianza'],
        additionalProperties: false
      }
    }
  },
  required: ['sugerencias'],
  additionalProperties: false
});

/**
 * Se queda con las sugerencias válidas: id pedido (una por id), categoría existente y distinta de
 * "Otros", confianza entre 0 y 1
 */
export const validarSugerencias = (respuesta, ids, categorias) => {
  const pedidos = new Set(ids);
  const validas = new Set(categorias.filter(c => c !== 'Otros'));
  const vistas = new Set();
  const resultado = [];
  for (const s of Array.isArray(respuesta?.sugerencias) ? respuesta.sugerencias : []) {
    if (!pedidos.has(s?.id) || vistas.has(s.id) || !validas.has(s.categoria)) continue;
    vistas.add(s.id);
    const confianza = Math.min(1, Math.max(0, Number(s.confianza) || 0));
    resultado.push({ id: s.id, categoria: s.categoria, confianza: Math.round(confianza * 100) / 100 });
  }
  return resultado;
};
