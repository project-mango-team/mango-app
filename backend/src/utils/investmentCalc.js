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
 * Resumen histórico de un activo: valor actual, flujos, ganancia y rendimiento, en USD y ARS.
 * Es el rendimiento del período "desde siempre hasta hoy" (ver calcularRendimientoPeriodo).
 * @param {{ moneda: string }} activo
 * @param {Array} movimientos - Con monto, monto_usd y monto_ars ya calculados
 * @param {{ usd: number, eur?: number }} cotizacionesHoy
 * @param {string} [hoy] - YYYY-MM-DD; por defecto la fecha actual
 */
export const calcularResumenActivo = (activo, movimientos, cotizacionesHoy, hoy = new Date().toISOString().slice(0, 10)) => {
  const valorActual = calcularValorActual(movimientos);
  const ultimaFecha = movimientos.reduce(
    (max, m) => (!max || new Date(m.fecha) > max ? new Date(m.fecha) : max),
    null
  );
  const hasta = ultimaFecha && toISO(ultimaFecha) > hoy ? toISO(ultimaFecha) : hoy;
  const r = calcularRendimientoPeriodo(activo, movimientos, { hasta }, () => cotizacionesHoy);

  return {
    valor_actual: redondear(valorActual),
    valor_actual_usd: r.valor_fin_usd,
    valor_actual_ars: r.valor_fin_ars,
    aportado_usd: r.aportado_usd,
    aportado_ars: r.aportado_ars,
    retirado_usd: r.retirado_usd,
    retirado_ars: r.retirado_ars,
    aporte_neto_usd: r.aporte_neto_usd,
    aporte_neto_ars: r.aporte_neto_ars,
    capital_promedio_usd: r.capital_promedio_usd,
    capital_promedio_ars: r.capital_promedio_ars,
    ganancia_usd: r.ganancia_usd,
    ganancia_ars: r.ganancia_ars,
    rendimiento_usd: r.rendimiento_usd,
    rendimiento_ars: r.rendimiento_ars,
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
    aporte_neto_usd: 0,
    aporte_neto_ars: 0,
    capital_promedio_usd: 0,
    capital_promedio_ars: 0,
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
    totales.aporte_neto_usd += resumen.aporte_neto_usd;
    totales.aporte_neto_ars += resumen.aporte_neto_ars;
    totales.capital_promedio_usd += resumen.capital_promedio_usd;
    totales.capital_promedio_ars += resumen.capital_promedio_ars;
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
  totales.rendimiento_usd = totales.capital_promedio_usd > EPSILON ? totales.ganancia_usd / totales.capital_promedio_usd : null;
  totales.rendimiento_ars = totales.capital_promedio_ars > EPSILON ? totales.ganancia_ars / totales.capital_promedio_ars : null;

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

const DIA_MS = 24 * 60 * 60 * 1000;
const diasEntre = (desde, hasta) => (new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / DIA_MS;

/**
 * Ganancia de un activo en un período [desde, hasta] (YYYY-MM-DD; sin desde = desde siempre)
 *   ganancia = valor_fin − valor_inicio + retiros − aportes del período
 * El valor inicial se convierte con la cotización del día anterior a `desde`, el final con la de `hasta`
 * y los flujos con la cotización guardada en cada movimiento.
 *
 * El % es ganancia / capital promedio (Modified Dietz): cada aporte o retiro pesa según cuánto tiempo
 * del período estuvo invertido. Así una cuenta que se usa como caja (aportes y retiros todos los días)
 * se mide contra la plata que realmente tuvo, no contra la suma bruta de todo lo que entró.
 * Para un activo que se compró al principio y no se tocó, da lo mismo que ganancia / aportado.
 * @param {(fecha: string) => { usd: number, eur?: number }} cotizacionesEn
 */
export const calcularRendimientoPeriodo = (activo, movimientos, { desde, hasta }, cotizacionesEn) => {
  const inicio = desde ? diaAnterior(desde) : null;
  const valorInicio = inicio ? valorEnFecha(movimientos, inicio) : 0;
  const valorFin = valorEnFecha(movimientos, hasta);
  const cero = { monto_usd: 0, monto_ars: 0 };

  const ini = valorInicio ? convertirMonto(valorInicio, activo.moneda, cotizacionesEn(inicio)) : cero;
  const fin = valorFin ? convertirMonto(valorFin, activo.moneda, cotizacionesEn(hasta)) : cero;

  const delPeriodo = movimientos.filter(m => {
    const f = toISO(m.fecha);
    return (!inicio || f > inicio) && f <= hasta;
  });
  const flujos = delPeriodo.filter(m => m.tipo === 'Aporte' || m.tipo === 'Retiro');

  const sumas = { aportado_usd: 0, aportado_ars: 0, retirado_usd: 0, retirado_ars: 0 };
  for (const m of flujos) {
    const clave = m.tipo === 'Aporte' ? 'aportado' : 'retirado';
    sumas[`${clave}_usd`] += m.monto_usd;
    sumas[`${clave}_ars`] += m.monto_ars;
  }

  // Ventana para ponderar: desde que hubo plata (o el inicio del rango) hasta `hasta`,
  // o hasta el último movimiento si en el período el activo terminó en cero (se cerró)
  const fechas = delPeriodo.map(m => toISO(m.fecha)).sort();
  const comienzo = desde && (valorInicio > EPSILON || !fechas.length || fechas[0] < desde) ? desde : (fechas[0] || hasta);
  const finVentana = valorFin < EPSILON && fechas.length ? fechas.at(-1) : hasta;
  const largo = diasEntre(comienzo, finVentana);
  const peso = (fecha) => (largo > 0 ? Math.min(1, Math.max(0, diasEntre(fecha, finVentana) / largo)) : 1);

  const capital = { usd: ini.monto_usd, ars: ini.monto_ars };
  for (const m of flujos) {
    const signo = m.tipo === 'Aporte' ? 1 : -1;
    const w = peso(toISO(m.fecha));
    capital.usd += signo * w * m.monto_usd;
    capital.ars += signo * w * m.monto_ars;
  }

  const gananciaUsd = fin.monto_usd - ini.monto_usd + sumas.retirado_usd - sumas.aportado_usd;
  const gananciaArs = fin.monto_ars - ini.monto_ars + sumas.retirado_ars - sumas.aportado_ars;

  return {
    valor_inicio_usd: redondear(ini.monto_usd),
    valor_inicio_ars: redondear(ini.monto_ars),
    valor_fin_usd: redondear(fin.monto_usd),
    valor_fin_ars: redondear(fin.monto_ars),
    aportado_usd: redondear(sumas.aportado_usd),
    aportado_ars: redondear(sumas.aportado_ars),
    retirado_usd: redondear(sumas.retirado_usd),
    retirado_ars: redondear(sumas.retirado_ars),
    aporte_neto_usd: redondear(sumas.aportado_usd - sumas.retirado_usd),
    aporte_neto_ars: redondear(sumas.aportado_ars - sumas.retirado_ars),
    capital_promedio_usd: redondear(capital.usd),
    capital_promedio_ars: redondear(capital.ars),
    ganancia_usd: redondear(gananciaUsd),
    ganancia_ars: redondear(gananciaArs),
    // null si no hubo capital invertido en el período (no hay contra qué medir)
    rendimiento_usd: capital.usd > EPSILON ? gananciaUsd / capital.usd : null,
    rendimiento_ars: capital.ars > EPSILON ? gananciaArs / capital.ars : null,
    // false si en el período no tuvo valor ni movimientos (no hace falta mostrarlo)
    activo_en_periodo: valorInicio > EPSILON || valorFin > EPSILON || flujos.length > 0
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
