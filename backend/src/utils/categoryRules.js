/**
 * Reglas de categorización (REV-02): condiciones sobre el movimiento → una acción.
 *
 * Una regla:
 *   condiciones: {
 *     detalle: { modo: 'contiene' | 'regex', valores: [String] }  // contiene: alguno de los textos; regex: un patrón
 *     origen: String | null, tipo: 'Gasto' | 'Ingreso' | null,
 *     montoMin: Number | null, montoMax: Number | null              // sobre el importe en ARS
 *   }
 *   accion: { tipo: 'categoria', categoria } | { tipo: 'ignorar' } | { tipo: 'inversion', activo_id } | { tipo: 'prestamo', deudor }
 *   (inversion: la transacción queda en la categoría Inversión y se ofrece cargarla como aporte o retiro del activo, INV-03)
 *
 * Todas las condiciones presentes se tienen que cumplir. Las reglas se evalúan en orden y gana la
 * primera que coincide, igual que las keywords que reemplazan.
 */

import { CATEGORIA_INVERSION, CATEGORIA_PRESTAMO } from '../models/User.js';
import { analizarRegex, esRegexSegura, MAX_TEXTO_REGEX } from './regexSegura.js';

export const CATEGORIA_SIN_REGLA = 'Otros';
export const MODOS_DETALLE = ['contiene', 'regex'];
export const TIPOS_ACCION = ['categoria', 'ignorar', 'inversion', 'prestamo'];
const MAX_DEUDOR = 80;
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
  } else if (a.tipo === 'prestamo') {
    const deudor = String(a.deudor || '').trim().replace(/\s+/g, ' ');
    if (!deudor) return { error: 'Escribí a quién le prestaste' };
    if (deudor.length > MAX_DEUDOR) return { error: `El nombre no puede superar ${MAX_DEUDOR} caracteres` };
    accion = { tipo: 'prestamo', categoria: CATEGORIA_PRESTAMO, deudor };
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
 * PUL-06: nivel de una regla. Las del usuario (creadas a mano o aprendidas) van en el nivel 0 y las asociaciones
 * anteriores (keywords migradas, que incluyen las default) en el nivel 1: una regla explícita del usuario siempre
 * se evalúa antes que una asociación anterior, aunque tenga un `orden` mayor.
 */
export const nivelDeRegla = (r) => (r?.creada_por === 'keywords' ? 1 : 0);

/**
 * Reglas en orden de evaluación: por nivel, después por `orden` y después por fecha de creación
 */
export const ordenarReglas = (reglas = []) => [...reglas].sort((a, b) =>
  nivelDeRegla(a) - nivelDeRegla(b)
  || (a.orden ?? 0) - (b.orden ?? 0)
  || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

/**
 * Prepara las reglas para evaluarlas muchas veces: activas, en orden y con el texto ya en mayúsculas
 */
export const compilarReglas = (reglas = []) => ordenarReglas(reglas.filter(r => r && r.activa !== false))
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

/**
 * Si la regla coincide, devuelve el texto que coincidió ('' si coincidió solo por origen, tipo o monto); si no, null
 */
const coincidencia = ({ regla, textos, regex }, t) => {
  const c = regla.condiciones || {};
  if (c.tipo && t.tipo !== c.tipo) return null;
  if (c.origen && t.origen !== c.origen) return null;
  const importe = Number(t.importe) || 0;
  if (c.montoMin !== null && c.montoMin !== undefined && importe < c.montoMin) return null;
  if (c.montoMax !== null && c.montoMax !== undefined && importe > c.montoMax) return null;
  const detalle = String(t.detalle || '');
  // Tope de largo del texto: acota el peor caso de una regex con varias repeticiones
  if (regex) return regex.test(detalle.slice(0, MAX_TEXTO_REGEX)) ? regex.source : null;
  if (textos.length === 0) return '';
  const upper = detalle.toUpperCase();
  const i = textos.findIndex(texto => upper.includes(texto));
  return i >= 0 ? String(regla.condiciones.detalle.valores[i]) : null;
};

/**
 * Primera regla que coincide con el movimiento y el texto que coincidió: { regla, texto } o null
 */
export const buscarCoincidencia = (t, compiladas) => {
  for (const c of compiladas) {
    const texto = coincidencia(c, t);
    if (texto !== null) return { regla: c.regla, texto };
  }
  return null;
};

/**
 * Primera regla que coincide con el movimiento, o null. Acepta reglas crudas o compiladas.
 */
export const buscarRegla = (t, compiladas) => buscarCoincidencia(t, compiladas)?.regla ?? null;

/**
 * PUL-06: ¿la regla `general` tapa a la `especifica`? (todo lo que matchea la específica matchea también la
 * general, así que si va primera la específica nunca se aplica). Es una heurística: con regex da false.
 */
export const pisaA = (general, especifica) => {
  const g = general.condiciones || {};
  const e = especifica.condiciones || {};
  const gv = (g.detalle?.valores || []).map(v => String(v).toUpperCase());
  const ev = (e.detalle?.valores || []).map(v => String(v).toUpperCase());
  if (g.detalle?.modo === 'regex' && gv.length) return false;
  if (e.detalle?.modo === 'regex' && ev.length) return false;
  if (gv.length) {
    if (!ev.length || !ev.every(t => gv.some(x => t.includes(x)))) return false;
  }
  if (g.origen && g.origen !== e.origen) return false;
  if (g.tipo && g.tipo !== e.tipo) return false;
  const hay = (v) => v !== null && v !== undefined;
  if (hay(g.montoMin) && !(hay(e.montoMin) && g.montoMin <= e.montoMin)) return false;
  if (hay(g.montoMax) && !(hay(e.montoMax) && e.montoMax <= g.montoMax)) return false;
  return true;
};

/**
 * PUL-06: ids de las reglas en el orden que queda al sumar `nueva`: va primera de las del usuario, salvo que
 * tape a una regla explícita más específica; en ese caso queda justo después de la última que taparía.
 * @param {Array} existentes - reglas ya guardadas (sin la nueva)
 * @param {Object} nueva
 */
export const ordenConNuevaRegla = (existentes, nueva) => {
  const ordenadas = ordenarReglas(existentes);
  let despuesDe = -1;
  ordenadas.forEach((e, i) => {
    if (nivelDeRegla(e) === 0 && pisaA(nueva, e) && !pisaA(e, nueva)) despuesDe = i;
  });
  const ids = ordenadas.map(r => String(r._id));
  ids.splice(despuesDe + 1, 0, String(nueva._id));
  return ids;
};

/**
 * Aplica las reglas a transacciones recién parseadas. La categoría solo se pisa si el parser la
 * dejó en "Otros" (respeta las que fija el parser, como Impuestos); ignorar aplica siempre.
 * Agrega `regla` (id de la regla que aplicó) e `ignorada: true` cuando corresponde.
 */
export const aplicarReglas = (transactions, reglas) => {
  const compiladas = compilarReglas(reglas);
  return transactions.map(t => {
    const coincide = buscarCoincidencia(t, compiladas);
    if (!coincide) return t;
    const { regla, texto } = coincide;
    const id = regla._id ? String(regla._id) : null;
    if (regla.accion?.tipo === 'ignorar') return { ...t, ignorada: true, regla: id };
    // La categoría que fijó el parser (Impuestos...) no se pisa; se marca para explicarlo en la revisión
    if (t.categoria && t.categoria !== CATEGORIA_SIN_REGLA) return { ...t, categoria_fija: true };
    // PUL-06: por qué se eligió esa categoría (se muestra en la revisión; no se guarda en la transacción)
    const motivo = (categoria) => ({
      texto: texto || null,
      modo: regla.condiciones?.detalle?.modo || 'contiene',
      creada_por: regla.creada_por || 'usuario',
      categoria
    });
    // La inversión solo marca a qué activo iría; el servidor recalcula y valida todo al previsualizar y al guardar
    if (regla.accion?.tipo === 'inversion') {
      return { ...t, categoria: CATEGORIA_INVERSION, regla: id, regla_motivo: motivo(CATEGORIA_INVERSION), inversion: { activo_id: String(regla.accion.activo_id) } };
    }
    // PUL-07: marca a quién se le prestó; el servidor recalcula y valida al previsualizar y al guardar
    if (regla.accion?.tipo === 'prestamo') {
      return { ...t, categoria: CATEGORIA_PRESTAMO, regla: id, regla_motivo: motivo(CATEGORIA_PRESTAMO), prestamo: { deudor: String(regla.accion.deudor || '') } };
    }
    return { ...t, categoria: regla.accion.categoria, regla: id, regla_motivo: motivo(regla.accion.categoria) };
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
