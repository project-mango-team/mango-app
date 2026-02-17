import Transaction from '../models/Transaction.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToTransactionData } from '../utils/userQuery.js';

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
    
    const filters = {};

    if (tipo) filters.tipo = tipo;
    if (mes) filters.mes = mes;
    if (categoria) filters.categoria = categoria;
    if (moneda) filters.moneda = moneda;
    if (origen) filters.origen = origen;
    
    // Year filter (matches dates ending with /YYYY)
    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum)) {
        filters.fecha = { $regex: `\\/${yearNum}$` };
      }
    }
    
    if (search) {
      filters.detalle = { $regex: search, $options: 'i' };
    }

    const query = buildUserQuery(req, filters);

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
    const query = buildUserQuery(req, { _id: req.params.id });
    const transaction = await Transaction.findOne(query);

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
    const transactionsWithUser = addUserToTransactionData(req, req.body.transactions);
    const transactions = await Transaction.insertMany(transactionsWithUser);

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
    const query = buildUserQuery(req, { _id: req.params.id });
    const transaction = await Transaction.findOneAndUpdate(
      query,
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
    const query = buildUserQuery(req, { _id: req.params.id });
    const transaction = await Transaction.findOneAndDelete(query);

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
    const query = buildUserQuery(req, { _id: { $in: ids } });
    const result = await Transaction.deleteMany(query);

    res.json({
      success: true,
      message: `${result.deletedCount} transactions deleted`
    });
  } catch (error) {
    next(error);
  }
};
