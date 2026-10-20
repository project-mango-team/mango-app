import { CATEGORIA_INVERSION, CATEGORIA_INTERNO } from '../models/User.js';

/**
 * Movimientos que no son gasto ni ingreso: la plata que va o vuelve de inversiones y los
 * movimientos internos (entre cuentas propias, pago de la tarjeta desde la caja de ahorro).
 * Devuelve el grupo en el que se muestran aparte, o null si cuentan como gasto o ingreso.
 */
export const grupoNeutro = (t) => {
  if (t.categoria === CATEGORIA_INVERSION) return 'inversiones';
  if (t.categoria === CATEGORIA_INTERNO) return 'internos';
  return null;
};

export const esNeutro = (t) => grupoNeutro(t) !== null;

/**
 * Totales de gastos e ingresos sin los movimientos neutros, que se suman aparte por grupo.
 * `monto(t)` da el importe en la moneda pedida.
 */
export const resumirMovimientos = (transactions, monto = (t) => t.importe) => {
  const resumen = {
    gastos: 0,
    ingresos: 0,
    inversiones: { enviado: 0, recibido: 0 },
    internos: { enviado: 0, recibido: 0 }
  };
  for (const t of transactions) {
    if (t.tipo !== 'Gasto' && t.tipo !== 'Ingreso') continue;
    const grupo = grupoNeutro(t);
    if (grupo) {
      resumen[grupo][t.tipo === 'Gasto' ? 'enviado' : 'recibido'] += monto(t);
    } else {
      resumen[t.tipo === 'Gasto' ? 'gastos' : 'ingresos'] += monto(t);
    }
  }
  return resumen;
};
