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
 * Marca cuáles operaciones ya existen como movimiento del activo (misma fecha, tipo y monto).
 * Compara por cantidad: si hay dos retiros iguales el mismo día y solo uno cargado, marca uno solo.
 * @param {Array<{ fecha: string, tipo: string, monto: number }>} operaciones
 * @param {Array<{ fecha: Date|string, tipo: string, monto: number }>} existentes
 * @returns {boolean[]} duplicado por cada operación, en el mismo orden
 */
export const marcarDuplicados = (operaciones, existentes) => {
  const clave = (fecha, tipo, monto) =>
    `${new Date(fecha).toISOString().slice(0, 10)}|${tipo}|${Math.round(monto * 100)}`;

  const disponibles = new Map();
  for (const m of existentes) {
    const k = clave(m.fecha, m.tipo, m.monto);
    disponibles.set(k, (disponibles.get(k) || 0) + 1);
  }

  return operaciones.map(op => {
    const k = clave(`${op.fecha}T00:00:00Z`, op.tipo, op.monto);
    const quedan = disponibles.get(k) || 0;
    if (quedan > 0) {
      disponibles.set(k, quedan - 1);
      return true;
    }
    return false;
  });
};
