// Control de totales de un resumen de tarjeta (ING-12): lo que dice el resumen (total a pagar,
// pago mínimo, saldo anterior, pagos e impuestos) contra lo que leyó el parser.
// Formatos: PDF de tarjeta Galicia del homebanking (Visa y Mastercard) y PDF de Visa de eresumen.com.ar.

// Monto argentino: 1.234,56 · -1.234,56 (homebanking) · 1.234,56- (eresumen). Sin pegarse a otros dígitos.
const MONTO = /(?<![\d.,])-?\d{1,3}(?:\.\d{3})*,\d{2}-?(?![\d,])|(?<![\d.,])-?\d+,\d{2}-?(?![\d,])/g;

// Líneas de impuestos y cargos del resumen (con o sin fecha adelante: DD-MM-YY o DD.MM.YY)
const FECHA_INICIAL = /^\d{2}[-.\/]\d{2}[-.\/]\d{2,4}\s+/;
const CARGO = /^(IMPUESTO|IMP\.|IIBB|IVA\s|DB\.?\s?RG|DEV\.?\s?IMP|PERCEP|INTERES|COMISION|CARGO|SEGURO|RENOVACION|PUNITORIO)/i;

const redondear = (n) => Math.round(n * 100) / 100;

const aNumero = (monto) => {
  const negativo = monto.startsWith('-') || monto.endsWith('-');
  const valor = parseFloat(monto.replace(/-/g, '').replace(/\./g, '').replace(',', '.'));
  return negativo ? -valor : valor;
};

const montosDe = (linea) => (linea.match(MONTO) || []).map(aNumero);

/**
 * Totales del resumen de tarjeta a partir del texto del PDF
 * @param {string} texto
 * @returns {null | {
 *   total: { ars: number, usd: number }, pago_minimo: number|null,
 *   saldo_anterior: { ars, usd }, pagos: { ars, usd }, consumos: { ars, usd }|null,
 *   cargos: Array<{ detalle: string, importe: number }>
 * }} null si no encuentra el total
 */
export const extraerTotalesTarjeta = (texto) => {
  if (!texto) return null;
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n')
    .map(l => l.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let total = null;
  let pagoMinimo = null;
  let saldoAnterior = null;
  let consumos = null;
  const pagos = { ars: 0, usd: 0 };
  const cargos = [];
  // Antes del consolidado hay montos del encabezado (saldo, pago mínimo, límites) que no son cargos
  let enResumen = false;

  // Hasta el total; en eresumen el pago mínimo viene justo después
  for (let i = 0; i < lineas.length && !(total && pagoMinimo !== null); i++) {
    const linea = lineas[i];
    const sinFecha = linea.replace(FECHA_INICIAL, '');
    const montos = montosDe(sinFecha);

    if (pagoMinimo === null && /^PAGO MINIMO/i.test(linea)) {
      // eresumen lo trae en la misma línea; el homebanking, unas líneas abajo ("En pesos" / "$ 8.130,00")
      const siguiente = [linea, ...lineas.slice(i + 1, i + 4)].map(montosDe).find(m => m.length);
      pagoMinimo = siguiente ? siguiente[0] : null;
      continue;
    }
    if (total) continue;

    if (/^CONSOLIDADO/i.test(linea)) {
      enResumen = true;
      continue;
    }

    if (/^SALDO ANTERIOR/i.test(sinFecha) && montos.length) {
      enResumen = true;
      saldoAnterior ??= { ars: montos[0], usd: montos[1] ?? 0 };
      continue;
    }

    if (/^(TOTAL A PAGAR|SALDO ACTUAL)/i.test(sinFecha) && montos.length) {
      total = { ars: montos[0], usd: montos[1] ?? 0 };
      continue;
    }

    if (!enResumen || !montos.length) continue;

    if (/^SU PAGO/i.test(sinFecha)) {
      const enDolares = /(USD|U\$S|DOLARES)/i.test(sinFecha);
      pagos[enDolares ? 'usd' : 'ars'] += montos.at(-1);
      continue;
    }

    // "TARJETA 1234 Total Consumos de ..." (Visa, una por tarjeta) o "TOTAL CONSUMOS DEL MES" (Mastercard)
    if (/Total Consumos/i.test(sinFecha)) {
      consumos = consumos || { ars: 0, usd: 0 };
      consumos.ars += montos[0];
      consumos.usd += montos[1] ?? 0;
      continue;
    }

    if (CARGO.test(sinFecha)) {
      // El importe es el último monto; lo de antes (base, alícuota) queda en el detalle
      const ultimo = [...sinFecha.matchAll(MONTO)].at(-1);
      const detalle = sinFecha.slice(0, ultimo.index).replace(/(\s*\$)+\s*$/, '').trim();
      cargos.push({ detalle, importe: montos.at(-1) });
    }
  }

  if (!total) return null;

  const par = (p) => ({ ars: redondear(p.ars), usd: redondear(p.usd) });
  return {
    total: par(total),
    pago_minimo: pagoMinimo,
    saldo_anterior: par(saldoAnterior || { ars: 0, usd: 0 }),
    pagos: par(pagos),
    consumos: consumos ? par(consumos) : null,
    cargos: cargos.map(c => ({ ...c, importe: redondear(c.importe) }))
  };
};

/**
 * Compara lo leído del resumen con sus totales y explica la diferencia en pesos:
 * saldo anterior que no se pagó y cargos/impuestos que no están entre las transacciones.
 * Los consumos en dólares se comparan en dólares (el resumen no los pesifica).
 * @param {Object|null} totales - Resultado de extraerTotalesTarjeta
 * @param {Array} transacciones - Todas las transacciones leídas del archivo (también las ya cargadas)
 * @returns {null | {
 *   ars: { importado, resumen, diferencia, saldo_pendiente, cargos_no_importados, sin_explicar },
 *   usd: { importado, resumen, diferencia, saldo_pendiente, sin_explicar },
 *   cargos: Array<{ detalle, importe, importado: boolean }>, pago_minimo: number|null
 * }}
 */
export const compararTotales = (totales, transacciones = []) => {
  if (!totales?.total) return null;

  const signo = (t) => (t.tipo === 'Ingreso' ? -1 : 1);
  const enPesos = transacciones.filter(t => t.moneda !== 'USD');
  const importadoArs = enPesos.reduce((s, t) => s + signo(t) * (Number(t.importe) || 0), 0);
  const importadoUsd = transacciones.filter(t => t.moneda === 'USD')
    .reduce((s, t) => s + signo(t) * (Number(t.monto_original) || 0), 0);

  // Un cargo está importado si hay una transacción en pesos por el mismo importe (cada una cuenta una vez)
  const centavos = (n) => Math.round(Math.abs(n) * 100);
  const disponibles = enPesos.map(t => ({ c: centavos(Number(t.importe) || 0), ingreso: t.tipo === 'Ingreso' }));
  const cargos = (totales.cargos || []).map(cargo => {
    const i = disponibles.findIndex(d => d.c === centavos(cargo.importe) && d.ingreso === cargo.importe < 0);
    if (i >= 0) disponibles.splice(i, 1);
    return { ...cargo, importado: i >= 0 };
  });

  const pendiente = (m) => (totales.saldo_anterior?.[m] || 0) + (totales.pagos?.[m] || 0);
  const noImportados = cargos.filter(c => !c.importado).reduce((s, c) => s + c.importe, 0);

  const difArs = totales.total.ars - importadoArs;
  const difUsd = totales.total.usd - importadoUsd;
  return {
    ars: {
      importado: redondear(importadoArs),
      resumen: totales.total.ars,
      diferencia: redondear(difArs),
      saldo_pendiente: redondear(pendiente('ars')),
      cargos_no_importados: redondear(noImportados),
      sin_explicar: redondear(difArs - pendiente('ars') - noImportados)
    },
    usd: {
      importado: redondear(importadoUsd),
      resumen: totales.total.usd,
      diferencia: redondear(difUsd),
      saldo_pendiente: redondear(pendiente('usd')),
      sin_explicar: redondear(difUsd - pendiente('usd'))
    },
    cargos,
    pago_minimo: totales.pago_minimo ?? null
  };
};
