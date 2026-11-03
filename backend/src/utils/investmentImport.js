// Importación de movimientos de inversión desde texto copiado de las apps de los brokers.
// Funciones puras: no tocan la DB.

const FECHA_BLOQUE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const TIPOS_FIMA = { Agregar: 'Aporte', Retirar: 'Retiro' };
const ESTADOS_FIMA = ['Realizada', 'En proceso', 'Anulada'];

/**
 * Número en formato argentino ("$1.234,56", "208,40") a Number
 */
const parseNumeroAR = (texto) => {
  const limpio = texto.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : NaN;
};

/**
 * Parsea el listado de operaciones de la app de Fima (Galicia), copiado como texto.
 * Cada operación es un bloque de líneas:
 *   2026/10/01 · Cuenta Fima · Agregar|Retirar · Realizada|En proceso|Anulada
 *   · [cuotapartes · $valor cuota] · $monto
 * Las cuotapartes y el valor de la cuota solo vienen en las operaciones realizadas.
 * @param {string} texto
 * @returns {{ operaciones: Array<{ fecha: string, tipo: 'Aporte'|'Retiro', monto: number, estado: string,
 *   cuotapartes?: number, valor_cuota?: number }>, errores: string[] }}
 */
export const parseOperacionesFima = (texto) => {
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const bloques = [];
  for (const linea of lineas) {
    const match = linea.match(FECHA_BLOQUE);
    if (match) {
      bloques.push({ fecha: `${match[1]}-${match[2]}-${match[3]}`, tokens: [] });
    } else if (bloques.length) {
      bloques.at(-1).tokens.push(linea);
    }
  }

  const operaciones = [];
  const errores = [];

  for (const { fecha, tokens } of bloques) {
    const tipoFima = tokens.find(t => TIPOS_FIMA[t]);
    const estado = tokens.find(t => ESTADOS_FIMA.includes(t));
    const conPesos = tokens.filter(t => t.startsWith('$'));
    const monto = conPesos.length ? parseNumeroAR(conPesos.at(-1)) : NaN;

    if (!tipoFima || !estado || !(monto > 0)) {
      errores.push(`No se pudo leer la operación del ${fecha}`);
      continue;
    }

    const op = { fecha, tipo: TIPOS_FIMA[tipoFima], monto, estado };
    // Realizadas: "208,40" (cuotapartes) y "$85,409772" (valor cuota) antes del monto
    if (conPesos.length >= 2) {
      const cuotapartes = parseNumeroAR(tokens[tokens.indexOf(conPesos.at(-2)) - 1] || '');
      const valorCuota = parseNumeroAR(conPesos.at(-2));
      if (cuotapartes > 0) op.cuotapartes = cuotapartes;
      if (valorCuota > 0) op.valor_cuota = valorCuota;
    }
    operaciones.push(op);
  }

  return { operaciones, errores };
};

/**
 * Empareja cada operación con un movimiento existente del activo (misma fecha, tipo y monto).
 * Compara por cantidad: si hay dos retiros iguales el mismo día y solo uno cargado, empareja uno solo.
 * @param {Array<{ fecha: string, tipo: string, monto: number }>} operaciones
 * @param {Array<{ fecha: Date|string, tipo: string, monto: number }>} existentes
 * @returns {Array<Object|null>} el movimiento existente de cada operación (o null), en el mismo orden
 */
export const emparejarExistentes = (operaciones, existentes) => {
  const clave = (fecha, tipo, monto) =>
    `${new Date(fecha).toISOString().slice(0, 10)}|${tipo}|${Math.round(monto * 100)}`;

  const disponibles = new Map();
  for (const m of existentes) {
    const k = clave(m.fecha, m.tipo, m.monto);
    if (!disponibles.has(k)) disponibles.set(k, []);
    disponibles.get(k).push(m);
  }

  return operaciones.map(op => disponibles.get(clave(`${op.fecha}T00:00:00Z`, op.tipo, op.monto))?.shift() ?? null);
};

/**
 * Marca cuáles operaciones ya existen como movimiento del activo (ver emparejarExistentes)
 * @returns {boolean[]} duplicado por cada operación, en el mismo orden
 */
export const marcarDuplicados = (operaciones, existentes) =>
  emparejarExistentes(operaciones, existentes).map(Boolean);

const DIA_MS = 86400000;
const diaDe = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(String(fecha).length <= 10 ? `${fecha}T00:00:00Z` : fecha);
  return Math.floor(d.getTime() / DIA_MS);
};

/**
 * Como emparejarExistentes, pero tolera que la fecha difiera hasta `dias` días (el extracto del banco y la app
 * del broker no siempre acreditan el mismo día). Mismo tipo y mismo monto al centavo; cada movimiento existente
 * se usa una sola vez y gana el más cercano en fecha (primero se emparejan los del mismo día).
 * @param {Array<{ fecha: Date|string, tipo: string, monto: number }>} operaciones
 * @param {Array<{ fecha: Date|string, tipo: string, monto: number }>} existentes
 * @param {{ dias?: number }} [opciones]
 * @returns {Array<Object|null>} el movimiento existente de cada operación (o null), en el mismo orden
 */
export const emparejarConTolerancia = (operaciones, existentes, { dias = 3 } = {}) => {
  const centavos = (monto) => Math.round(monto * 100);
  const libres = existentes.map(e => ({ e, dia: diaDe(e.fecha), tipo: e.tipo, c: centavos(e.monto), usado: false }));
  const resultado = operaciones.map(() => null);

  for (let tolerancia = 0; tolerancia <= dias; tolerancia++) {
    operaciones.forEach((op, i) => {
      if (resultado[i]) return;
      const dia = diaDe(op.fecha);
      const c = centavos(op.monto);
      const candidato = libres
        .filter(l => !l.usado && l.tipo === op.tipo && l.c === c && Math.abs(l.dia - dia) === tolerancia)[0];
      if (candidato) {
        candidato.usado = true;
        resultado[i] = candidato.e;
      }
    });
  }
  return resultado;
};
