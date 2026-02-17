import Transaction from '../models/Transaction.js';
import { AppError } from '../middleware/errorHandler.js';

// Get all transactions with filters
export const getTransactions = async (req, res, next) => {
  try {
    const { 
      tipo, 
      mes, 
      year,
      categoria,
      moneda,
      origen,
      search,
      limit = 100,
      skip = 0
    } = req.query;
    
    const query = {};

    if (tipo) query.tipo = tipo;
    if (mes) query.mes = mes;
    if (categoria) query.categoria = categoria;
    if (moneda) query.moneda = moneda;
    if (origen) query.origen = origen;
    
    // Year filter (matches dates ending with /YYYY)
    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum)) {
        query.fecha = { $regex: `\\/${yearNum}$` };
      }
    }
    
    if (search) {
      query.detalle = { $regex: search, $options: 'i' };
    }

    const transactions = await Transaction.find(query)
      .sort({ fecha: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      count: transactions.length,
      total,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// Get single transaction
export const getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// Create transactions (bulk)
export const createTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.insertMany(req.body.transactions);

    res.status(201).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// Update transaction
export const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// Delete transaction
export const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    res.json({
      success: true,
      message: 'Transaction deleted'
    });
  } catch (error) {
    next(error);
  }
};

// Delete multiple transactions
export const deleteTransactions = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const result = await Transaction.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} transactions deleted`
    });
  } catch (error) {
    next(error);
  }
};
