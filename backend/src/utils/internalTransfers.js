import { normalizarFecha } from './transactionDedup.js';
import { CATEGORIA_INTERNO } from '../models/User.js';

// Detección de transferencias entre cuentas propias (REV-04): un egreso en una cuenta y un ingreso
// del mismo monto en otra, con pocos días de diferencia. Funciones puras.

export const DIAS_TOLERANCIA = 2;

const DIA_MS = 24 * 60 * 60 * 1000;

// Días desde epoch de una fecha DD/MM/YYYY (o DD-MM-YY), o null
export const diaDeFecha = (fecha) => {
  const [d, m, y] = normalizarFecha(fecha).split('/').map(Number);
  if (!d || !m || !y) return null;
  return Math.round(Date.UTC(y, m - 1, d) / DIA_MS);
};

const fechaDeDia = (dia) => {
  const f = new Date(dia * DIA_MS);
  const dd = String(f.getUTCDate()).padStart(2, '0');
  const mm = String(f.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${f.getUTCFullYear()}`;
};

/**
 * Fechas (DD/MM/YYYY) donde puede estar la contraparte de estas transacciones: cada fecha ± la tolerancia
 */
export const fechasCandidatas = (transactions, dias = DIAS_TOLERANCIA) => {
  const fechas = new Set();
  for (const t of transactions) {
    const dia = diaDeFecha(t.fecha);
    if (dia === null) continue;
    for (let i = -dias; i <= dias; i++) fechas.add(fechaDeDia(dia + i));
  }
  return [...fechas];
};

// En USD se compara el monto en dólares (el importe en pesos depende de la cotización de cada import)
const montoComparable = (t) => {
  const moneda = t.moneda || 'ARS';
  return `${moneda}|${Math.round(Math.abs(Number(moneda === 'USD' ? t.monto_original : t.importe) || 0) * 100)}`;
};

const esCandidata = (t) => !t.duplicado && !t.ignorada && (t.tipo === 'Gasto' || t.tipo === 'Ingreso');

const resumen = (t) => ({
  ...(t._id && { _id: String(t._id) }),
  fecha: t.fecha,
  detalle: t.detalle,
  origen: t.origen,
  categoria: t.categoria,
  tipo: t.tipo
});

/**
 * Sugiere como movimiento interno cada transacción nueva que tenga una contraparte: tipo opuesto,
 * mismo monto y moneda, otro origen y hasta `dias` de diferencia. La contraparte puede estar ya
 * cargada (`existentes`) o en la misma importación. Cada transacción se empareja con una sola, la
 * más cercana en fecha. No sugiere si las dos ya son Movimiento interno.
 * Agrega `interno_sugerido: { con, dias }` a las que emparejó.
 */
export const sugerirInternos = (nuevas, existentes = [], { dias = DIAS_TOLERANCIA } = {}) => {
  const candidatas = [
    ...nuevas.map((t, i) => ({ t, nueva: i, dia: diaDeFecha(t.fecha) })),
    ...existentes.map(t => ({ t, nueva: null, dia: diaDeFecha(t.fecha) }))
  ].filter(c => c.dia !== null && esCandidata(c.t));

  // Todos los pares posibles con al menos una nueva, del más cercano al más lejano
  const porMonto = new Map();
  for (const c of candidatas) {
    const clave = montoComparable(c.t);
    if (!porMonto.has(clave)) porMonto.set(clave, []);
    porMonto.get(clave).push(c);
  }
  const pares = [];
  for (const grupo of porMonto.values()) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const a = grupo[i];
        const b = grupo[j];
        if (a.nueva === null && b.nueva === null) continue;
        if (a.t.tipo === b.t.tipo || (a.t.origen || '') === (b.t.origen || '')) continue;
        if (a.t.categoria === CATEGORIA_INTERNO && b.t.categoria === CATEGORIA_INTERNO) continue;
        const distancia = Math.abs(a.dia - b.dia);
        if (distancia <= dias) pares.push({ a, b, distancia });
      }
    }
  }
  pares.sort((x, y) => x.distancia - y.distancia);

  const usadas = new Set();
  const sugerencias = new Map();
  for (const { a, b, distancia } of pares) {
    if (usadas.has(a) || usadas.has(b)) continue;
    usadas.add(a);
    usadas.add(b);
    if (a.nueva !== null) sugerencias.set(a.nueva, { con: resumen(b.t), dias: distancia });
    if (b.nueva !== null) sugerencias.set(b.nueva, { con: resumen(a.t), dias: distancia });
  }

  return nuevas.map((t, i) => (sugerencias.has(i) ? { ...t, interno_sugerido: sugerencias.get(i) } : t));
};

/**
 * Ids de contrapartes ya cargadas para las transacciones que se guardan como Movimiento interno
 * aceptando la sugerencia: también pasan a Movimiento interno.
 */
export const contrapartesAMarcar = (transactions) => [...new Set(transactions
  .filter(t => t.categoria === CATEGORIA_INTERNO && t.interno_con)
  .map(t => String(t.interno_con)))];
