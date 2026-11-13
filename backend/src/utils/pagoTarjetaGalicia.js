// Pago de la tarjeta de Galicia desde la caja de ahorro (PUL-08) y de la tarjeta de Mercado Pago desde la cuenta (MP-11).
// En el extracto de la caja de ahorro el pago del resumen cae como "PAGO TARJETA VISA ..." (o MASTER). Si el resumen de
// esa tarjeta ya se importó (mismo total, unos días después del cierre), el pago es plata que ya está contada en sus
// consumos: se marca como movimiento interno. Si el resumen todavía no está importado, queda "pendiente" y NO se toca
// (no se neutraliza un pago sin los consumos cargados: se perdería el gasto).

import { esPagoTarjetaMP } from './pagoTarjeta.js';

const sinTildes = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const PAGO_TARJETA_GALICIA = /^PAG(?:O|OS)?\s+(?:DE\s+)?TARJ(?:ETA)?\.?\s+(?:DE\s+CREDITO\s+)?(VISA|MASTER(?:\s*CARD)?)\b/;

/**
 * ¿El detalle de la caja de ahorro es el pago de una tarjeta Galicia? Devuelve el producto o null.
 * @returns {{ producto: 'visa'|'mastercard' } | null}
 */
export const esPagoTarjetaGalicia = (detalle) => {
  const limpio = sinTildes(detalle).toUpperCase().replace(/\s+/g, ' ').trim();
  const m = PAGO_TARJETA_GALICIA.exec(limpio);
  if (!m) return null;
  return { producto: m[1] === 'VISA' ? 'visa' : 'mastercard' };
};

/**
 * ¿Es un pago de tarjeta de Galicia hecho desde la caja de ahorro? (gasto en pesos de Banco Galicia que no sea
 * duplicado ni ignorado). Devuelve { producto } o null.
 */
export const reconocerPagoGalicia = (t) => {
  if (!t || t.tipo !== 'Gasto' || t.origen !== 'Banco Galicia' || (t.moneda && t.moneda !== 'ARS') || t.duplicado || t.ignorada) return null;
  return esPagoTarjetaGalicia(t.detalle);
};

/**
 * MP-11: ¿es el pago automático de la tarjeta de Mercado Pago desde la cuenta de MP? Devuelve { producto: 'tarjeta' } o null.
 */
export const reconocerPagoMP = (t) => {
  if (!t || t.tipo !== 'Gasto' || t.origen !== 'Mercado Pago' || (t.moneda && t.moneda !== 'ARS') || t.duplicado || t.ignorada) return null;
  return esPagoTarjetaMP(t.detalle) ? { producto: 'tarjeta' } : null;
};

const DIA_MS = 86400000;
const diaDe = (iso) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DIA_MS);
const fechaDeTransaccion = (fecha) => {
  const p = String(fecha || '').trim().replace(/-/g, '/').split('/');
  if (p.length !== 3) return null;
  const [d, m, y] = p;
  const iso = `${y.length === 2 ? `20${y}` : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
};

/**
 * Empareja los pagos de tarjeta de una importación de caja de ahorro con resúmenes de tarjeta ya importados.
 * Devuelve, por transacción: null (no es un pago de tarjeta) | { estado: 'cubierto', resumen } | { estado: 'pendiente', producto }.
 * Coincide si el producto es el mismo (o el detalle no lo dice), el importe difiere hasta `tolerancia` pesos del total
 * del resumen y la fecha está entre el cierre y `dias` días después. Cada resumen se usa una sola vez y gana el cierre
 * más cercano. Solo gastos en pesos de Banco Galicia que no sean duplicados ni ignorados.
 * @param {Array} transacciones
 * @param {Array<{ ingest_document_id, operation_id, filename, producto, cierre: string|null, total: number }>} resumenes
 */
export const emparejarPagosConResumenes = (transacciones, resumenes, { tolerancia = 1, dias = 30, reconocer = reconocerPagoGalicia } = {}) => {
  const usados = new Set();
  return transacciones.map(t => {
    const pago = reconocer(t);
    if (!pago) return null;
    const fecha = fechaDeTransaccion(t.fecha);
    const importe = Math.abs(Number(t.importe) || 0);
    const distancia = (r) => (fecha && r.cierre ? Math.abs(diaDe(fecha) - diaDe(r.cierre)) : 0);

    const candidatos = resumenes
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => !usados.has(i)
        && (!r.producto || r.producto === pago.producto)
        && Math.abs(importe - r.total) <= tolerancia
        && (!r.cierre || !fecha || (diaDe(fecha) >= diaDe(r.cierre) && diaDe(fecha) - diaDe(r.cierre) <= dias)))
      .sort((a, b) => distancia(a.r) - distancia(b.r));
    if (!candidatos.length) return { estado: 'pendiente', producto: pago.producto };
    usados.add(candidatos[0].i);
    return { estado: 'cubierto', resumen: candidatos[0].r };
  });
};
