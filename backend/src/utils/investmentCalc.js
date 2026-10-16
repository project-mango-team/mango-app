// Cálculos de inversiones. Funciones puras: no tocan la DB ni llaman APIs.
//
// valor_actual = última valuación + aportes posteriores − retiros posteriores
// ganancia     = valor_actual + Σ retiros − Σ aportes
// Los flujos se convierten con la cotización de su fecha; el valor actual con la de hoy.

const EPSILON = 0.005;

/**
 * Convierte un monto en la moneda del activo a ARS y USD
 * @param {number} monto
 * @param {'ARS'|'USD'|'EUR'} moneda
 * @param {{ usd: number, eur?: number }} cotizaciones - ARS por USD y ARS por EUR
 * @returns {{ monto_ars: number, monto_usd: number }}
 */
export const convertirMonto = (monto, moneda, { usd, eur }) => {
  if (!(usd > 0)) {
    throw new Error('Cotización USD inválida');
  }

  let montoArs;
  if (moneda === 'ARS') {
    montoArs = monto;
  } else if (moneda === 'USD') {
    montoArs = monto * usd;
  } else if (moneda === 'EUR') {
    if (!(eur > 0)) {
      throw new Error('Cotización EUR inválida');
    }
    montoArs = monto * eur;
  } else {
    throw new Error(`Moneda no soportada: ${moneda}`);
  }

  return {
    monto_ars: montoArs,
    monto_usd: moneda === 'USD' ? monto : montoArs / usd
  };
};

/**
 * Ordena movimientos por fecha y, dentro del mismo día, por orden de carga
 */
export const ordenarMovimientos = (movimientos) =>
  [...movimientos].sort((a, b) => {
    const diff = new Date(a.fecha) - new Date(b.fecha);
    if (diff !== 0) return diff;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

/**
 * Valor del activo en su moneda original después de aplicar todos los movimientos
 * @param {Array} movimientos - Movimientos del activo (cualquier orden)
 * @returns {number}
 */
export const calcularValorActual = (movimientos) =>
  ordenarMovimientos(movimientos).reduce((valor, mov) => {
    if (mov.tipo === 'Valuacion') return mov.monto;
    if (mov.tipo === 'Aporte') return valor + mov.monto;
    if (mov.tipo === 'Retiro') return valor - mov.monto;
    return valor;
  }, 0);

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Resumen de un activo: valor actual, aportado, retirado, ganancia y rendimiento, en USD y ARS
 * @param {{ moneda: string }} activo
 * @param {Array} movimientos - Con monto, monto_usd y monto_ars ya calculados
 * @param {{ usd: number, eur?: number }} cotizacionesHoy
 */
export const calcularResumenActivo = (activo, movimientos, cotizacionesHoy) => {
  const valorActual = calcularValorActual(movimientos);
  const { monto_usd: valorUsd, monto_ars: valorArs } = convertirMonto(
    valorActual,
    activo.moneda,
    cotizacionesHoy
  );

  const totales = { aportado_usd: 0, aportado_ars: 0, retirado_usd: 0, retirado_ars: 0 };
  let ultimaFecha = null;

  for (const mov of movimientos) {
    if (mov.tipo === 'Aporte') {
      totales.aportado_usd += mov.monto_usd;
      totales.aportado_ars += mov.monto_ars;
    } else if (mov.tipo === 'Retiro') {
      totales.retirado_usd += mov.monto_usd;
      totales.retirado_ars += mov.monto_ars;
    }
    if (!ultimaFecha || new Date(mov.fecha) > ultimaFecha) {
      ultimaFecha = new Date(mov.fecha);
    }
  }

  const gananciaUsd = valorUsd + totales.retirado_usd - totales.aportado_usd;
  const gananciaArs = valorArs + totales.retirado_ars - totales.aportado_ars;

  return {
    valor_actual: redondear(valorActual),
    valor_actual_usd: redondear(valorUsd),
    valor_actual_ars: redondear(valorArs),
    aportado_usd: redondear(totales.aportado_usd),
    aportado_ars: redondear(totales.aportado_ars),
    retirado_usd: redondear(totales.retirado_usd),
    retirado_ars: redondear(totales.retirado_ars),
    ganancia_usd: redondear(gananciaUsd),
    ganancia_ars: redondear(gananciaArs),
    rendimiento_usd: totales.aportado_usd > 0 ? gananciaUsd / totales.aportado_usd : 0,
    rendimiento_ars: totales.aportado_ars > 0 ? gananciaArs / totales.aportado_ars : 0,
    cerrado: movimientos.length > 0 && Math.abs(valorActual) < EPSILON,
    cantidad_movimientos: movimientos.length,
    ultimo_movimiento: ultimaFecha
  };
};
