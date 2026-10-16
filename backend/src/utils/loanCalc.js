// Cálculos de préstamos. Funciones puras: no tocan la DB ni llaman APIs.

const EPSILON = 0.005;
const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Monto en USD de un movimiento de préstamo cargado en ARS o USD
 */
export const montoPrestamoUsd = (monto, moneda, cotizacionUsd) => {
  if (moneda === 'USD') return monto;
  if (!(cotizacionUsd > 0)) {
    throw new Error('Cotización USD inválida');
  }
  return monto / cotizacionUsd;
};

/**
 * Saldo pendiente (USD) de un deudor; nombre comparado sin distinguir mayúsculas
 * @param {Array} movimientos - Todos los movimientos de préstamos del usuario
 * @param {string} deudor
 * @param {string} [excluirId] - Movimiento a ignorar (al editar)
 */
export const saldoDeudor = (movimientos, deudor, excluirId) => {
  const clave = deudor.trim().toLowerCase();
  return movimientos
    .filter(m => m.deudor.trim().toLowerCase() === clave && String(m._id) !== String(excluirId))
    .reduce((saldo, m) => saldo + (m.tipo === 'Prestamo' ? m.monto_usd : -m.monto_usd), 0);
};

/**
 * Resumen por deudor: prestado, devuelto, saldo y si está saldado.
 * Agrupa por nombre sin distinguir mayúsculas y usa la grafía del movimiento más reciente.
 * @param {Array} movimientos
 * @returns {{ pendientes: Array, saldados: Array, total_pendiente_usd: number }}
 */
export const resumirPrestamos = (movimientos) => {
  const porDeudor = new Map();

  for (const m of movimientos) {
    const clave = m.deudor.trim().toLowerCase();
    const actual = porDeudor.get(clave) || {
      deudor: m.deudor,
      prestado_usd: 0,
      devuelto_usd: 0,
      cantidad_movimientos: 0,
      ultimo_movimiento: null
    };
    if (m.tipo === 'Prestamo') actual.prestado_usd += m.monto_usd;
    else actual.devuelto_usd += m.monto_usd;
    actual.cantidad_movimientos += 1;
    const fecha = new Date(m.fecha);
    if (!actual.ultimo_movimiento || fecha > actual.ultimo_movimiento) {
      actual.ultimo_movimiento = fecha;
      actual.deudor = m.deudor;
    }
    porDeudor.set(clave, actual);
  }

  const deudores = [...porDeudor.values()].map(d => {
    const saldo = d.prestado_usd - d.devuelto_usd;
    return {
      ...d,
      prestado_usd: redondear(d.prestado_usd),
      devuelto_usd: redondear(d.devuelto_usd),
      saldo_usd: redondear(saldo),
      saldado: Math.abs(saldo) < EPSILON
    };
  });

  const pendientes = deudores.filter(d => !d.saldado).sort((a, b) => b.saldo_usd - a.saldo_usd);
  const saldados = deudores.filter(d => d.saldado).sort((a, b) => b.ultimo_movimiento - a.ultimo_movimiento);

  return {
    pendientes,
    saldados,
    total_pendiente_usd: redondear(pendientes.reduce((sum, d) => sum + d.saldo_usd, 0))
  };
};
