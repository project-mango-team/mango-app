// Pago del resumen de la tarjeta de crédito de Mercado Pago, tal como aparece en la cuenta (MP-07).
// En el CSV de la cuenta cae como "Pago automático Tarjeta de crédito" (o "Pago Tarjeta de crédito" si lo
// hace el usuario a mano). Es plata que pasa de la cuenta a la tarjeta, no un gasto: los consumos de la
// tarjeta se cargan aparte desde su resumen.

export const CATEGORIA_PAGO_TARJETA = 'Movimiento interno';

const sinTildes = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Anclada al principio y con la palabra "pago": un consumo en un comercio que se llame "Tarjeta de crédito X"
// no coincide, ni tampoco "Pago de servicios" o "Pago con tarjeta".
const PAGO_TARJETA_MP = /^pago\s+(automatico\s+)?(de\s+)?(la\s+)?tarjeta\s+de\s+credito\b/;

/**
 * ¿El detalle de un movimiento de la cuenta de Mercado Pago es el pago del resumen de la tarjeta?
 * @param {string} detalle
 * @returns {boolean}
 */
export const esPagoTarjetaMP = (detalle) => {
  const limpio = sinTildes(detalle).toLowerCase().replace(/\s+/g, ' ').trim();
  return PAGO_TARJETA_MP.test(limpio);
};

/**
 * Transacciones de la cuenta de Mercado Pago que son pagos de la tarjeta (gastos de la cuenta).
 * Solo reconoce, no cambia nada: la decisión de neutralizarlas depende de que estén cargados los consumos (MP-11).
 * @param {Array<{ detalle: string, tipo?: string, origen?: string }>} transacciones
 */
export const pagosDeTarjeta = (transacciones = []) => transacciones.filter(t =>
  t?.tipo !== 'Ingreso' &&
  (!t?.origen || t.origen === 'Mercado Pago') &&
  esPagoTarjetaMP(t?.detalle)
);
