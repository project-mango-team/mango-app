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

/**
 * Totales del portfolio a partir de activos que ya traen su `resumen`
 * Solo cuenta activos abiertos; la liquidez sale del flag `liquido` de cada tipo.
 * @param {Array<{ tipo: string, resumen: Object }>} activos
 * @param {Array<{ nombre: string, liquido: boolean }>} tipos
 */
export const calcularTotalesPortfolio = (activos, tipos) => {
  const liquidos = new Set(tipos.filter(t => t.liquido).map(t => t.nombre));
  const totales = {
    valor_usd: 0,
    valor_ars: 0,
    aportado_usd: 0,
    aportado_ars: 0,
    ganancia_usd: 0,
    ganancia_ars: 0,
    liquidez_usd: 0,
    liquidez_ars: 0
  };
  const porTipo = new Map();

  for (const { tipo, resumen } of activos) {
    if (resumen.cerrado) continue;

    totales.valor_usd += resumen.valor_actual_usd;
    totales.valor_ars += resumen.valor_actual_ars;
    totales.aportado_usd += resumen.aportado_usd;
    totales.aportado_ars += resumen.aportado_ars;
    totales.ganancia_usd += resumen.ganancia_usd;
    totales.ganancia_ars += resumen.ganancia_ars;
    if (liquidos.has(tipo)) {
      totales.liquidez_usd += resumen.valor_actual_usd;
      totales.liquidez_ars += resumen.valor_actual_ars;
    }

    const actual = porTipo.get(tipo) || { tipo, valor_usd: 0, valor_ars: 0, liquido: liquidos.has(tipo) };
    actual.valor_usd += resumen.valor_actual_usd;
    actual.valor_ars += resumen.valor_actual_ars;
    porTipo.set(tipo, actual);
  }

  for (const key of Object.keys(totales)) {
    totales[key] = redondear(totales[key]);
  }
  totales.rendimiento_usd = totales.aportado_usd > 0 ? totales.ganancia_usd / totales.aportado_usd : 0;
  totales.rendimiento_ars = totales.aportado_ars > 0 ? totales.ganancia_ars / totales.aportado_ars : 0;

  const por_tipo = [...porTipo.values()]
    .map(t => ({ ...t, valor_usd: redondear(t.valor_usd), valor_ars: redondear(t.valor_ars) }))
    .sort((a, b) => b.valor_usd - a.valor_usd);

  return { totales, por_tipo };
};

// ---------- Rendimientos ----------

const toISO = (fecha) => new Date(fecha).toISOString().slice(0, 10);

/**
 * Valor del activo (moneda original) al final del día `fecha` (YYYY-MM-DD)
 */
export const valorEnFecha = (movimientos, fecha) =>
  calcularValorActual(movimientos.filter(m => toISO(m.fecha) <= fecha));

/**
 * Busca en un historial ordenado [{ fecha, promedio }] la cotización del día o la anterior más cercana
 * @returns {number|undefined}
 */
export const cotizacionEnFecha = (historial, fecha) => {
  if (!historial?.length) return undefined;
  if (fecha < historial[0].fecha) return historial[0].promedio;
  let lo = 0;
  let hi = historial.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (historial[mid].fecha <= fecha) lo = mid;
    else hi = mid - 1;
  }
  return historial[lo].promedio;
};

const diaAnterior = (fecha) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Ganancia de un activo en un período [desde, hasta] (YYYY-MM-DD; sin desde = desde siempre)
 * ganancia = valor_fin − valor_inicio + retiros − aportes del período
 * El valor inicial se convierte con la cotización del día anterior a `desde`, el final con la de `hasta`
 * y los flujos con la cotización guardada en cada movimiento.
 * @param {(fecha: string) => { usd: number, eur?: number }} cotizacionesEn
 */
export const calcularRendimientoPeriodo = (activo, movimientos, { desde, hasta }, cotizacionesEn) => {
  const inicio = desde ? diaAnterior(desde) : null;
  const valorInicio = inicio ? valorEnFecha(movimientos, inicio) : 0;
  const valorFin = valorEnFecha(movimientos, hasta);
  const cero = { monto_usd: 0, monto_ars: 0 };

  const ini = valorInicio ? convertirMonto(valorInicio, activo.moneda, cotizacionesEn(inicio)) : cero;
  const fin = valorFin ? convertirMonto(valorFin, activo.moneda, cotizacionesEn(hasta)) : cero;

  const flujos = { aportado_usd: 0, aportado_ars: 0, retirado_usd: 0, retirado_ars: 0 };
  for (const m of movimientos) {
    const f = toISO(m.fecha);
    if ((inicio && f <= inicio) || f > hasta) continue;
    if (m.tipo === 'Aporte') {
      flujos.aportado_usd += m.monto_usd;
      flujos.aportado_ars += m.monto_ars;
    } else if (m.tipo === 'Retiro') {
      flujos.retirado_usd += m.monto_usd;
      flujos.retirado_ars += m.monto_ars;
    }
  }

  const gananciaUsd = fin.monto_usd - ini.monto_usd + flujos.retirado_usd - flujos.aportado_usd;
  const gananciaArs = fin.monto_ars - ini.monto_ars + flujos.retirado_ars - flujos.aportado_ars;
  // Base del %: lo que había al inicio más lo aportado en el período
  const baseUsd = ini.monto_usd + flujos.aportado_usd;
  const baseArs = ini.monto_ars + flujos.aportado_ars;

  return {
    valor_inicio_usd: redondear(ini.monto_usd),
    valor_inicio_ars: redondear(ini.monto_ars),
    valor_fin_usd: redondear(fin.monto_usd),
    valor_fin_ars: redondear(fin.monto_ars),
    aportado_usd: redondear(flujos.aportado_usd),
    aportado_ars: redondear(flujos.aportado_ars),
    retirado_usd: redondear(flujos.retirado_usd),
    retirado_ars: redondear(flujos.retirado_ars),
    ganancia_usd: redondear(gananciaUsd),
    ganancia_ars: redondear(gananciaArs),
    rendimiento_usd: baseUsd > 0 ? gananciaUsd / baseUsd : 0,
    rendimiento_ars: baseArs > 0 ? gananciaArs / baseArs : 0,
    // false si en el período no tuvo valor ni movimientos (no hace falta mostrarlo)
    activo_en_periodo: valorInicio > EPSILON || valorFin > EPSILON || flujos.aportado_usd > 0 || flujos.retirado_usd > 0
  };
};

/**
 * Último día de cada mes entre `desde` y `hasta`; el último punto es `hasta`
 * @returns {string[]} fechas YYYY-MM-DD
 */
export const cierresDeMes = (desde, hasta) => {
  const fechas = [];
  let [y, m] = desde.slice(0, 7).split('-').map(Number);
  for (;;) {
    const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (finMes >= hasta) {
      fechas.push(hasta);
      return fechas;
    }
    fechas.push(finMes);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
};

/**
 * Serie mensual del portfolio: valor total vs capital neto aportado (aportes − retiros) acumulado.
 * La diferencia entre ambos es la ganancia acumulada a esa fecha.
 * @param {Array<{ moneda: string, movimientos: Array }>} activos
 * @param {string[]} fechas - Cierres de mes (YYYY-MM-DD)
 * @param {(fecha: string) => { usd: number, eur?: number }} cotizacionesEn
 */
export const calcularSerieMensual = (activos, fechas, cotizacionesEn) =>
  fechas.map(fecha => {
    const cot = cotizacionesEn(fecha);
    const punto = { valor_usd: 0, valor_ars: 0, capital_usd: 0, capital_ars: 0 };

    for (const { moneda, movimientos } of activos) {
      const valor = valorEnFecha(movimientos, fecha);
      if (valor) {
        const { monto_usd, monto_ars } = convertirMonto(valor, moneda, cot);
        punto.valor_usd += monto_usd;
        punto.valor_ars += monto_ars;
      }
      for (const m of movimientos) {
        if (toISO(m.fecha) > fecha) continue;
        const signo = m.tipo === 'Aporte' ? 1 : m.tipo === 'Retiro' ? -1 : 0;
        punto.capital_usd += signo * m.monto_usd;
        punto.capital_ars += signo * m.monto_ars;
      }
    }

    return {
      fecha,
      valor_usd: redondear(punto.valor_usd),
      valor_ars: redondear(punto.valor_ars),
      capital_usd: redondear(punto.capital_usd),
      capital_ars: redondear(punto.capital_ars),
      ganancia_usd: redondear(punto.valor_usd - punto.capital_usd),
      ganancia_ars: redondear(punto.valor_ars - punto.capital_ars)
    };
  });
