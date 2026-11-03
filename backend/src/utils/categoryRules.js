/**
 * Reglas de categorización (REV-02): condiciones sobre el movimiento → una acción.
 *
 * Una regla:
 *   condiciones: {
 *     detalle: { modo: 'contiene' | 'regex', valores: [String] }  // contiene: alguno de los textos; regex: un patrón
 *     origen: String | null, tipo: 'Gasto' | 'Ingreso' | null,
 *     montoMin: Number | null, montoMax: Number | null              // sobre el importe en ARS
 *   }
 *   accion: { tipo: 'categoria', categoria } | { tipo: 'ignorar' } | { tipo: 'inversion', activo_id }
 *   (inversion: la transacción queda en la categoría Inversión y se ofrece cargarla como aporte o retiro del activo, INV-03)
 *
 * Todas las condiciones presentes se tienen que cumplir. Las reglas se evalúan en orden y gana la
 * primera que coincide, igual que las keywords que reemplazan.
 */

import { CATEGORIA_INVERSION } from '../models/User.js';
import { analizarRegex, esRegexSegura, MAX_TEXTO_REGEX } from './regexSegura.js';

export const CATEGORIA_SIN_REGLA = 'Otros';
export const MODOS_DETALLE = ['contiene', 'regex'];
export const TIPOS_ACCION = ['categoria', 'ignorar', 'inversion'];
const ID_RE = /^[a-f0-9]{24}$/i;
const MAX_REGEX = 200;

const vacio = (v) => v === undefined || v === null || v === '';

const compilarRegex = (patron) => {
  try {
    return new RegExp(patron, 'i');
  } catch {
    return null;
  }
};

/**
 * Normaliza lo que llega del cliente y devuelve { regla, error }. `categorias` son las del usuario.
 */
export const validarRegla = (datos, categorias = []) => {
  const c = datos?.condiciones || {};
  const modo = c.detalle?.modo || 'contiene';
  if (!MODOS_DETALLE.includes(modo)) return { error: 'Modo de detalle inválido' };

  const valores = [...new Set((Array.isArray(c.detalle?.valores) ? c.detalle.valores : [])
    .map(v => String(v).trim())
    .filter(Boolean))];
  if (modo === 'regex') {
    if (valores.length !== 1) return { error: 'La expresión regular tiene que ser una sola' };
    if (valores[0].length > MAX_REGEX) return { error: `La expresión regular no puede superar ${MAX_REGEX} caracteres` };
    if (!compilarRegex(valores[0])) return { error: 'La expresión regular no es válida' };
    // ReDoS: una regex como (a+)+$ frena el servidor. Si hace falta, partila en varias reglas o usá "contiene alguno de".
    const analisis = analizarRegex(valores[0]);
    if (!analisis.segura) return { error: `La expresión regular se rechaza por seguridad: ${analisis.motivo}. Usá una más simple o varias reglas.` };
  }

  const tipo = vacio(c.tipo) ? null : c.tipo;
  if (tipo && !['Gasto', 'Ingreso'].includes(tipo)) return { error: 'Tipo inválido' };
  const origen = vacio(c.origen) ? null : String(c.origen).trim();

  const numero = (v) => (vacio(v) ? null : Number(v));
  const montoMin = numero(c.montoMin);
  const montoMax = numero(c.montoMax);
  if ([montoMin, montoMax].some(m => m !== null && (!Number.isFinite(m) || m < 0))) {
    return { error: 'Los montos tienen que ser números positivos' };
  }
  if (montoMin !== null && montoMax !== null && montoMin > montoMax) {
    return { error: 'El monto mínimo no puede ser mayor que el máximo' };
  }

  if (valores.length === 0 && !tipo && !origen && montoMin === null && montoMax === null) {
    return { error: 'La regla necesita al menos una condición' };
  }

  const a = datos?.accion || {};
  if (!TIPOS_ACCION.includes(a.tipo)) return { error: 'Acción inválida' };
  let accion = { tipo: 'ignorar' };
  if (a.tipo === 'categoria') {
    const categoria = String(a.categoria || '').trim();
    if (!categoria) return { error: 'Elegí una categoría' };
    if (categorias.length && !categorias.includes(categoria)) return { error: 'La categoría no existe' };
    accion = { tipo: 'categoria', categoria };
  } else if (a.tipo === 'inversion') {
    const activoId = String(a.activo_id || '').trim();
    if (!ID_RE.test(activoId)) return { error: 'Elegí la inversión' };
    accion = { tipo: 'inversion', categoria: CATEGORIA_INVERSION, activo_id: activoId };
  }

  return {
    regla: {
      condiciones: { detalle: { modo, valores }, origen, tipo, montoMin, montoMax },
      accion,
      activa: datos?.activa !== false
    }
  };
};

/**
 * Prepara las reglas para evaluarlas muchas veces: activas, en orden y con el texto ya en mayúsculas
 */
export const compilarReglas = (reglas = []) => [...reglas]
  .filter(r => r && r.activa !== false)
  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  .map(r => {
    const d = r.condiciones?.detalle || {};
    const valores = d.valores || [];
    return {
      regla: r,
      textos: d.modo === 'regex' ? null : valores.map(v => String(v).toUpperCase()),
      // Una regex insegura que ya estuviera guardada (de antes del chequeo) no se evalúa: no coincide con nada
      regex: d.modo === 'regex' && valores[0] && esRegexSegura(valores[0]) ? compilarRegex(valores[0]) : null
    };
  })
  // Una regex que dejó de compilar no coincide con nada (en vez de romper la importación)
  .filter(c => c.textos || c.regex);

const cumple = ({ regla, textos, regex }, t) => {
  const c = regla.condiciones || {};
  if (c.tipo && t.tipo !== c.tipo) return false;
  if (c.origen && t.origen !== c.origen) return false;
  const importe = Number(t.importe) || 0;
  if (c.montoMin !== null && c.montoMin !== undefined && importe < c.montoMin) return false;
  if (c.montoMax !== null && c.montoMax !== undefined && importe > c.montoMax) return false;
  const detalle = String(t.detalle || '');
  // Tope de largo del texto: acota el peor caso de una regex con varias repeticiones
  if (regex) return regex.test(detalle.slice(0, MAX_TEXTO_REGEX));
  if (textos.length === 0) return true;
  const upper = detalle.toUpperCase();
  return textos.some(texto => upper.includes(texto));
};

/**
 * Primera regla que coincide con el movimiento, o null. Acepta reglas crudas o compiladas.
 */
export const buscarRegla = (t, compiladas) => {
  for (const c of compiladas) {
    if (cumple(c, t)) return c.regla;
  }
  return null;
};

/**
 * Aplica las reglas a transacciones recién parseadas. La categoría solo se pisa si el parser la
 * dejó en "Otros" (respeta las que fija el parser, como Impuestos); ignorar aplica siempre.
 * Agrega `regla` (id de la regla que aplicó) e `ignorada: true` cuando corresponde.
 */
export const aplicarReglas = (transactions, reglas) => {
  const compiladas = compilarReglas(reglas);
  return transactions.map(t => {
    const regla = buscarRegla(t, compiladas);
    if (!regla) return t;
    const id = regla._id ? String(regla._id) : null;
    if (regla.accion?.tipo === 'ignorar') return { ...t, ignorada: true, regla: id };
    if (t.categoria && t.categoria !== CATEGORIA_SIN_REGLA) return t;
    // La inversión solo marca a qué activo iría; el servidor recalcula y valida todo al previsualizar y al guardar
    if (regla.accion?.tipo === 'inversion') {
      return { ...t, categoria: CATEGORIA_INVERSION, regla: id, inversion: { activo_id: String(regla.accion.activo_id) } };
    }
    return { ...t, categoria: regla.accion.categoria, regla: id };
  });
};

/**
 * Convierte el mapa de keywords (categoría → textos) en reglas equivalentes: una por categoría,
 * "detalle contiene alguno de", en el mismo orden. Como gana la primera que coincide, clasifica
 * exactamente igual que las keywords.
 */
export const reglasDesdeKeywords = (keywords) => {
  const entradas = keywords instanceof Map ? [...keywords.entries()] : Object.entries(keywords || {});
  return entradas
    .map(([categoria, lista]) => [categoria, (Array.isArray(lista) ? lista : []).map(k => String(k).trim()).filter(Boolean)])
    .filter(([, lista]) => lista.length > 0)
    .map(([categoria, lista], i) => ({
      condiciones: { detalle: { modo: 'contiene', valores: lista }, origen: null, tipo: null, montoMin: null, montoMax: null },
      accion: { tipo: 'categoria', categoria },
      activa: true,
      orden: i,
      creada_por: 'keywords'
    }));
};
