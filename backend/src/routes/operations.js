import express from 'express';
import Operation from '../models/Operation.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

/**
 * GET /api/operations
 * Get all operations (history of imports/migrations)
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, status, limit = 50 } = req.query;
    
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const operations = await Operation.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: operations.length,
      data: operations
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/operations/:operationId
 * Get details of a specific operation
 */
router.get('/:operationId', async (req, res, next) => {
  try {
    const { operationId } = req.params;

    const operation = await Operation.findOne({ operation_id: operationId });

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Operación no encontrada'
      });
    }

    // Get sample transactions for this operation
    const sampleTransactions = await Transaction.find({ operation_id: operationId })
      .limit(10);

    res.json({
      success: true,
      data: {
        ...operation.toObject(),
        sample_transactions: sampleTransactions
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/operations/:operationId/rollback
 * Rollback an operation (delete all its transactions)
 */
router.post('/:operationId/rollback', async (req, res, next) => {
  try {
    const { operationId } = req.params;

    // Find the operation
    const operation = await Operation.findOne({ operation_id: operationId });

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Operación no encontrada'
      });
    }

    // Check if already rolled back
    if (operation.status === 'rolled_back') {
      return res.status(400).json({
        success: false,
        message: 'Esta operación ya fue revertida'
      });
    }

    // Delete all transactions with this operation_id
    const deleteResult = await Transaction.deleteMany({ operation_id: operationId });

    // Update operation status
    operation.status = 'rolled_back';
    operation.rolled_back_at = new Date();
    await operation.save();

    res.json({
      success: true,
      message: `Se eliminaron ${deleteResult.deletedCount} transacciones de la operación "${operation.filename}"`,
      data: {
        operation_id: operationId,
        deleted_count: deleteResult.deletedCount,
        filename: operation.filename,
        type: operation.type,
        rolled_back_at: operation.rolled_back_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/operations/stats/summary
 * Get summary statistics of all operations
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const totalOperations = await Operation.countDocuments();
    const completedOperations = await Operation.countDocuments({ status: 'completed' });
    const rolledBackOperations = await Operation.countDocuments({ status: 'rolled_back' });
    
    const operationsByType = await Operation.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total_transactions: { $sum: '$transactions_count' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        total_operations: totalOperations,
        completed: completedOperations,
        rolled_back: rolledBackOperations,
        by_type: operationsByType
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
