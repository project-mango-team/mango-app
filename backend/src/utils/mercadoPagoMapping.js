// Mercado Pago por API (MP-01): convierte el reporte de liberaciones de la API en el CSV que lee
// MercadoPagoParser, para que la sync entre a la Bandeja como cualquier archivo. Funciones puras.
// Ver plans/mercadopago.md.

// Filas de saldo del reporte: no son movimientos
const REGISTROS_DE_SALDO = new Set(['initial_available_balance', 'available_balance', 'total', 'subtotal']);

// DESCRIPTION del reporte → detalle en Mango. Los rendimientos usan el mismo texto que el CSV
// manual, así categorizan igual y deduplican contra lo ya importado.
const DETALLES = {
  asset_management_gain: 'Rendimientos',
  asset_management_loss: 'Rendimientos negativos',
  payout: 'Transferencia enviada',
  withdrawal: 'Transferencia enviada',
  refund: 'Devolución',
  credit_payment: 'Cuota de préstamo Mercado Pago',
  chargeback: 'Contracargo',
  mediation: 'Reclamo',
  mediation_cancel: 'Reclamo cancelado',
  shipping: 'Envío',
  shipping_cancel: 'Envío cancelado'
};

/**
 * Separa una línea de CSV respetando comillas ("a;b" queda junto, "" es una comilla)
 */
const separarLinea = (linea, separador) => {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map(campo => campo.trim());
};

/**
 * Lee el CSV del reporte de liberaciones (separador "," o ";", encabezados en inglés)
 * @param {string} texto
 * @returns {Object[]} una fila por línea, con las claves del encabezado en mayúsculas
 */
export const leerReporteLiberaciones = (texto) => {
  const lineas = String(texto ?? '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lineas.length) return [];
  const separador = lineas[0].includes(';') ? ';' : ',';
  const encabezado = separarLinea(lineas[0], separador).map(h => h.toUpperCase());
  if (!encabezado.includes('DATE') || !encabezado.includes('DESCRIPTION')) {
    throw new Error('El reporte de Mercado Pago no tiene las columnas DATE y DESCRIPTION');
  }
  return lineas.slice(1).map(linea => {
    const campos = separarLinea(linea, separador);
    return Object.fromEntries(encabezado.map((h, i) => [h, campos[i] ?? '']));
  });
};

/**
 * Monto del reporte a número. La API usa punto decimal ("1234.56"); por las dudas acepta el
 * formato argentino ("1.234,56").
 */
export const montoDelReporte = (valor) => {
  const s = String(valor ?? '').trim();
  if (!s) return 0;
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fecha del reporte (ISO "2026-10-01T09:15:00.000-04:00", "2026-10-01" o "01/10/2026") a DD-MM-YYYY,
 * el formato del CSV manual. Toma el día tal como viene: el reporte ya está en la zona horaria
 * configurada (GMT-04 por defecto, la misma que el CSV que baja el usuario).
 */
export const fechaDelReporte = (valor) => {
  const s = String(valor ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

/**
 * Detalle de un movimiento a partir del código DESCRIPTION y el sentido del monto
 */
export const detalleMovimiento = (descripcion, monto) => {
  const codigo = String(descripcion ?? '').trim().toLowerCase();
  if (DETALLES[codigo]) return DETALLES[codigo];
  if (codigo === 'payment') return monto >= 0 ? 'Pago recibido' : 'Pago';
  if (codigo.startsWith('tax_withholding')) return 'Retención de impuestos';
  if (codigo.startsWith('tax_')) return 'Impuesto';
  if (codigo.startsWith('reserve_for_')) return 'Reserva de dinero';
  // Código desconocido: queda visible en la revisión para agregarlo a la tabla
  return codigo ? `Mercado Pago ${codigo}` : 'Movimiento Mercado Pago';
};

/**
 * Movimientos del reporte de liberaciones, sin las filas de saldo ni las de monto cero
 * @param {Object[]} filas - salida de leerReporteLiberaciones
 * @returns {{ movimientos: Object[], saldoInicial: number|null, otrasMonedas: string[] }}
 *   movimientos: { fecha (DD-MM-YYYY), detalle, referencia, monto (con signo), saldo (o null) }
 */
export const movimientosDelReporte = (filas) => {
  const movimientos = [];
  const otrasMonedas = new Set();
  let saldoInicial = null;

  for (const fila of filas) {
    const tipoRegistro = String(fila.RECORD_TYPE ?? '').trim().toLowerCase();
    const monto = Math.round((montoDelReporte(fila.NET_CREDIT_AMOUNT) - montoDelReporte(fila.NET_DEBIT_AMOUNT)) * 100) / 100;
    const saldo = fila.BALANCE_AMOUNT ? montoDelReporte(fila.BALANCE_AMOUNT) : null;

    if (tipoRegistro === 'initial_available_balance') {
      saldoInicial = saldo ?? monto;
      continue;
    }
    if (REGISTROS_DE_SALDO.has(tipoRegistro) || monto === 0) continue;

    // La cuenta argentina opera en pesos: otra moneda no se importa, se avisa
    const moneda = String(fila.CURRENCY ?? '').trim().toUpperCase();
    if (moneda && moneda !== 'ARS') {
      otrasMonedas.add(moneda);
      continue;
    }

    const fecha = fechaDelReporte(fila.DATE);
    if (!fecha) continue;

    movimientos.push({
      fecha,
      detalle: detalleMovimiento(fila.DESCRIPTION, monto),
      referencia: String(fila.SOURCE_ID ?? '').trim(),
      monto,
      saldo
    });
  }

  return { movimientos, saldoInicial, otrasMonedas: [...otrasMonedas] };
};

/**
 * Número en formato argentino con dos decimales y sin separador de miles ("-1234,50"):
 * es lo que entiende BaseParser.cleanAmount
 */
const montoArgentino = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

// El separador del CSV es ";": se saca de los textos para no romper columnas
const textoSeguro = (s) => String(s ?? '').replace(/[;\r\n"]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Arma el CSV con el formato del reporte que baja el usuario a mano (el que lee MercadoPagoParser),
 * para meter los movimientos de la API en la Bandeja sin un camino aparte.
 * @param {Object[]} movimientos - salida de movimientosDelReporte
 * @param {{ saldoInicial?: number|null }} opciones
 * @returns {string}
 */
export const csvParaBandeja = (movimientos, { saldoInicial = null } = {}) => {
  const creditos = movimientos.filter(m => m.monto > 0).reduce((s, m) => s + m.monto, 0);
  const debitos = movimientos.filter(m => m.monto < 0).reduce((s, m) => s + m.monto, 0);
  const inicial = saldoInicial ?? 0;
  const final = inicial + creditos + debitos;

  let saldo = inicial;
  const filas = movimientos.map(m => {
    saldo += m.monto;
    return [
      m.fecha,
      textoSeguro(m.detalle),
      textoSeguro(m.referencia),
      montoArgentino(m.monto),
      montoArgentino(m.saldo ?? saldo)
    ].join(';');
  });

  return [
    'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE',
    [inicial, creditos, debitos, final].map(montoArgentino).join(';'),
    '',
    'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE',
    ...filas
  ].join('\n') + '\n';
};

/**
 * Nombre del archivo para la Bandeja, con el período
 * @param {string} desde - YYYY-MM-DD
 * @param {string} hasta - YYYY-MM-DD
 */
export const nombreArchivoSync = (desde, hasta) => `mercadopago-api-${desde}-a-${hasta}.csv`;
