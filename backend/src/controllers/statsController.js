import Transaction from '../models/Transaction.js';
import { buildUserQuery } from '../utils/userQuery.js';

// Helper function to build date filters
const buildDateFilter = (year) => {
  if (!year || year === 'all') return {};
  
  const yearNum = parseInt(year);
  if (isNaN(yearNum)) return {};
  
  // Match dates in format DD/MM/YYYY for the given year
  return {
    fecha: { $regex: `\\/${yearNum}$` }
  };
};

// Get general stats
export const getStats = async (req, res, next) => {
  try {
    const { year } = req.query;
    const dateFilter = buildDateFilter(year);
    const query = buildUserQuery(req, dateFilter);

    const transactions = await Transaction.find(query);

    const gastos = transactions
      .filter(t => t.tipo === 'Gasto')
      .reduce((sum, t) => sum + t.importe, 0);

    const ingresos = transactions
      .filter(t => t.tipo === 'Ingreso')
      .reduce((sum, t) => sum + t.importe, 0);

    res.json({
      success: true,
      data: {
        total_gastos: gastos,
        total_ingresos: ingresos,
        balance: ingresos - gastos,
        num_transacciones: transactions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get expenses by category
export const getGastosByCategoria = async (req, res, next) => {
  try {
    const { year } = req.query;
    const dateFilter = buildDateFilter(year);
    const matchFilter = buildUserQuery(req, { tipo: 'Gasto', ...dateFilter });
    
    const gastos = await Transaction.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$categoria',
          total: { $sum: '$importe' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({
      success: true,
      data: gastos.map(g => ({
        categoria: g._id,
        total: g.total
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Get monthly summary
export const getMonthlySummary = async (req, res, next) => {
  try {
    const { year } = req.query;
    const dateFilter = buildDateFilter(year);
    
    const mesesOrden = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const gastos = await Transaction.aggregate([
      { $match: buildUserQuery(req, { tipo: 'Gasto', ...dateFilter }) },
      {
        $group: {
          _id: '$mes',
          total: { $sum: '$importe' }
        }
      }
    ]);

    const ingresos = await Transaction.aggregate([
      { $match: buildUserQuery(req, { tipo: 'Ingreso', ...dateFilter }) },
      {
        $group: {
          _id: '$mes',
          total: { $sum: '$importe' }
        }
      }
    ]);

    // Combinar datos
    const summary = mesesOrden.map(mes => {
      const gastoData = gastos.find(g => g._id === mes);
      const ingresoData = ingresos.find(i => i._id === mes);

      const gastoTotal = gastoData ? gastoData.total : 0;
      const ingresoTotal = ingresoData ? ingresoData.total : 0;

      return {
        mes,
        gastos: gastoTotal,
        ingresos: ingresoTotal,
        balance: ingresoTotal - gastoTotal
      };
    });

    res.json({
      success: true,
      data: summary
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
