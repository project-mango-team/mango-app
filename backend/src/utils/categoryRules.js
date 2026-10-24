/**
 * Reglas de categorización (REV-02): condiciones sobre el movimiento → una acción.
 *
 * Una regla:
 *   condiciones: {
 *     detalle: { modo: 'contiene' | 'regex', valores: [String] }  // contiene: alguno de los textos; regex: un patrón
 *     origen: String | null, tipo: 'Gasto' | 'Ingreso' | null,
 *     montoMin: Number | null, montoMax: Number | null              // sobre el importe en ARS
 *   }
 *   accion: { tipo: 'categoria', categoria } | { tipo: 'ignorar' }
 *
 * Todas las condiciones presentes se tienen que cumplir. Las reglas se evalúan en orden y gana la
 * primera que coincide, igual que las keywords que reemplazan.
 */

export const CATEGORIA_SIN_REGLA = 'Otros';
export const MODOS_DETALLE = ['contiene', 'regex'];
export const TIPOS_ACCION = ['categoria', 'ignorar'];
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
      regex: d.modo === 'regex' && valores[0] ? compilarRegex(valores[0]) : null
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
  if (regex) return regex.test(detalle);
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
