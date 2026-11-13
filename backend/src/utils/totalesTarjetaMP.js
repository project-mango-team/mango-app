// Totales del resumen de la tarjeta de crédito de Mercado Pago (MP-08), a partir del texto del PDF.
// Devuelve la misma forma que extraerTotalesTarjeta (utils/totalesResumen.js) para que el control de totales
// (compararTotales) y la importación automática funcionen sin cambios.
//
// El PDF trae un bloque "Consolidado" con una fila por concepto ("Consumos $ 1.234,56 US$ 7,89") y, debajo, el detalle
// de movimientos. La portada repite los totales con separadores raros ("$ 634.15100"): no se usa.

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const MESES_LARGOS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

export const mesDeAbreviatura = (abreviatura) => MESES[String(abreviatura).toLowerCase().slice(0, 3)] ?? null;

const redondear = (n) => Math.round(n * 100) / 100;

// "-$ 1.234,56" · "$ 1.234,56" · "US$ 7,89" → número (con signo)
const aNumero = (texto) => {
  const negativo = /-/.test(texto);
  const valor = parseFloat(texto.replace(/[^\d,]/g, '').replace(',', '.'));
  return Number.isFinite(valor) ? (negativo ? -valor : valor) : 0;
};

const MONTO_ARS = /(-?)\s*(?<!US)\$\s*(-?[\d.]+,\d{2})/;
const MONTO_USD = /(-?)\s*US\$\s*(-?[\d.]+,\d{2})/;

/**
 * Pesos y dólares de una línea del consolidado ("Consumos $ 10,00 US$ 2,00"). Falta una columna → 0.
 */
export const montosDeLinea = (linea) => {
  const ars = MONTO_ARS.exec(linea);
  const usd = MONTO_USD.exec(linea);
  return {
    ars: ars ? aNumero(`${ars[1]}${ars[2]}`) : 0,
    usd: usd ? aNumero(`${usd[1]}${usd[2]}`) : 0,
    tieneArs: Boolean(ars),
    tieneUsd: Boolean(usd)
  };
};

/**
 * Fecha de cierre del resumen en YYYY-MM-DD. El PDF solo dice "9 de octubre" (sin año): se toma el año del cierre más
 * reciente que no sea posterior a la fecha de referencia (por defecto hoy, con una semana de margen).
 * @param {string} texto
 * @param {Date} [referencia]
 */
export const cierreDelResumen = (texto, referencia = new Date()) => {
  const m = /Fecha de cierre\s*\n?\s*(\d{1,2}) de ([a-záéíóú]+)/i.exec(texto) || /Cierre actual\s+(\d{1,2}) de ([a-záéíóú]+)/i.exec(texto);
  if (!m) return null;
  const mes = MESES_LARGOS[m[2].toLowerCase()];
  if (!mes) return null;
  const dia = Number(m[1]);
  const limite = new Date(referencia.getTime() + 7 * 86400000);
  let anio = limite.getUTCFullYear();
  if (new Date(Date.UTC(anio, mes - 1, dia)) > limite) anio--;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

/**
 * Totales del resumen. null si no encuentra el consolidado o el total.
 * @param {string} texto
 * @returns {null | {
 *   total: { ars: number, usd: number }, pago_minimo: number|null,
 *   saldo_anterior: { ars, usd }, pagos: { ars, usd }, consumos: { ars, usd }|null,
 *   cargos: Array<{ detalle: string, importe: number }>
 * }}
 */
export const extraerTotalesTarjetaMP = (texto) => {
  if (!texto) return null;
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const inicio = lineas.findIndex(l => /^Consolidado$/i.test(l));
  if (inicio < 0) return null;

  let saldo = { ars: 0, usd: 0 };
  let consumos = null;
  let impuestos = 0;
  let pagosAnticipados = { ars: 0, usd: 0 };
  let ajustes = { ars: 0, usd: 0 };
  let total = null;

  for (const linea of lineas.slice(inicio + 1, inicio + 14)) {
    const montos = montosDeLinea(linea);
    if (/^Saldo del periodo anterior/i.test(linea)) saldo = { ars: montos.ars, usd: montos.usd };
    else if (/^Consumos/i.test(linea)) consumos = { ars: montos.ars, usd: montos.usd };
    else if (/^Impuestos e intereses/i.test(linea)) impuestos = montos.ars;
    else if (/^Pagos anticipados/i.test(linea)) pagosAnticipados = { ars: montos.ars, usd: montos.usd };
    else if (/^Ajustes y reembolsos/i.test(linea)) ajustes = { ars: montos.ars, usd: montos.usd };
    else if (/^Total a pagar/i.test(linea)) { total = { ars: montos.ars, usd: montos.usd }; break; }
  }
  if (!total) return null;

  // "El mínimo a pagar es $ 634.151 00" (los centavos a veces vienen separados) o con coma normal
  const minimo = /m[ií]nimo a pagar es\s*\$\s*([\d.]+)(?:,|\s)(\d{2})\b/i.exec(texto);
  const pagoMinimo = minimo ? parseFloat(`${minimo[1].replace(/\./g, '')}.${minimo[2]}`) : null;

  // Cargos del detalle (impuestos e intereses): sirven para explicar la diferencia si no se importan
  const cargos = [];
  const desde = lineas.findIndex(l => /^Impuestos e intereses\d?$/i.test(l));
  if (desde >= 0) {
    for (const linea of lineas.slice(desde + 1)) {
      if (/^Subtotal/i.test(linea) || /^Pagos anticipados$/i.test(linea)) break;
      const fila = /^\d{1,2}\/[a-z]{3}\s+(.+?)\s*(-?\s*\$\s*-?[\d.]+,\d{2})\s*$/i.exec(linea);
      if (fila) cargos.push({ detalle: fila[1].trim(), importe: redondear(aNumero(fila[2])) });
    }
  }

  return {
    total: { ars: redondear(total.ars), usd: redondear(total.usd) },
    pago_minimo: pagoMinimo,
    saldo_anterior: { ars: redondear(saldo.ars), usd: redondear(saldo.usd) },
    // Los pagos anticipados no son transacciones del resumen: explican la diferencia con lo importado
    pagos: { ars: redondear(-pagosAnticipados.ars) || 0, usd: redondear(-pagosAnticipados.usd) || 0 },
    consumos: consumos ? { ars: redondear(consumos.ars), usd: redondear(consumos.usd) } : null,
    cargos,
    ajustes: { ars: redondear(ajustes.ars), usd: redondear(ajustes.usd) },
    impuestos_ars: redondear(impuestos)
  };
};
