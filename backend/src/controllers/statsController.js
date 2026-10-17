import Transaction from '../models/Transaction.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { CATEGORIA_INVERSION } from '../models/User.js';
import { DolarService } from '../services/dolarService.js';
import { montoTransaccionUsd } from '../utils/transactionCurrency.js';

const MESES_ORDEN = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Helper function to build date filters
const buildDateFilter = (year) => {
  if (!year || year === 'all') return {};
  
  const yearNum = parseInt(year);
  if (isNaN(yearNum)) return {};
  
  // Match dates in format DD/MM/YYYY for the given year
  return {
    fecha: { $regex: `\/${yearNum}$` }
  };
};

/**
 * Transacciones del filtro de año con una función que da el monto en la moneda pedida.
 * ?moneda=USD convierte cada transacción con el dólar blue de su fecha (o usa el monto original
 * si fue en dólares); no modifica nada guardado. Por defecto, ARS (el importe tal cual).
 */
const cargarTransacciones = async (req) => {
  const moneda = req.query.moneda === 'USD' ? 'USD' : 'ARS';
  const query = buildUserQuery(req, buildDateFilter(req.query.year));
  const transactions = await Transaction.find(query)
    .select('tipo categoria mes fecha importe moneda monto_original')
    .lean();

  if (moneda === 'ARS') {
    return { moneda, transactions, monto: (t) => t.importe };
  }
  const historial = await DolarService.getHistorial('blue');
  return { moneda, transactions, monto: (t) => montoTransaccionUsd(t, historial) };
};

// La plata que va o vuelve de inversiones no es gasto ni ingreso: se muestra aparte
const esInversion = (t) => t.categoria === CATEGORIA_INVERSION;

// Get general stats
export const getStats = async (req, res, next) => {
  try {
    const { moneda, transactions, monto } = await cargarTransacciones(req);

    const sumar = (tipo, inversion) => transactions
      .filter(t => t.tipo === tipo && esInversion(t) === inversion)
      .reduce((sum, t) => sum + monto(t), 0);

    const gastos = sumar('Gasto', false);
    const ingresos = sumar('Ingreso', false);

    res.json({
      success: true,
      moneda,
      data: {
        total_gastos: gastos,
        total_ingresos: ingresos,
        balance: ingresos - gastos,
        num_transacciones: transactions.length,
        inversiones: {
          enviado: sumar('Gasto', true),
          recibido: sumar('Ingreso', true)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get expenses by category
export const getGastosByCategoria = async (req, res, next) => {
  try {
    const { moneda, transactions, monto } = await cargarTransacciones(req);

    const totales = new Map();
    for (const t of transactions) {
      if (t.tipo !== 'Gasto' || esInversion(t)) continue;
      totales.set(t.categoria, (totales.get(t.categoria) || 0) + monto(t));
    }

    res.json({
      success: true,
      moneda,
      data: [...totales.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total)
    });
  } catch (error) {
    next(error);
  }
};

// Get monthly summary
export const getMonthlySummary = async (req, res, next) => {
  try {
    const { moneda, transactions, monto } = await cargarTransacciones(req);

    const porMes = new Map(MESES_ORDEN.map(mes => [mes, { gastos: 0, ingresos: 0 }]));
    for (const t of transactions) {
      if (esInversion(t) || !porMes.has(t.mes)) continue;
      const clave = t.tipo === 'Gasto' ? 'gastos' : t.tipo === 'Ingreso' ? 'ingresos' : null;
      if (clave) porMes.get(t.mes)[clave] += monto(t);
    }

    res.json({
      success: true,
      moneda,
      data: MESES_ORDEN.map(mes => {
        const { gastos, ingresos } = porMes.get(mes);
        return { mes, gastos, ingresos, balance: ingresos - gastos };
      })
    });
  } catch (error) {
    next(error);
  }
};

// Get available years
export const getAvailableYears = async (req, res, next) => {
  try {
    const query = buildUserQuery(req);
    const transactions = await Transaction.find(query, { fecha: 1 });
    const years = [...new Set(
      transactions.map(t => {
        const parts = t.fecha.split('/');
        return parts.length === 3 ? parseInt(parts[2]) : null;
      }).filter(y => y !== null)
    )].sort((a, b) => b - a);

    res.json({
      success: true,
      data: years
    });
  } catch (error) {
    next(error);
  }
};
