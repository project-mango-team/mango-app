import express from 'express';
import Operation from '../models/Operation.js';
import Transaction from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';
import { buildUserQuery } from '../utils/userQuery.js';
import IngestDocument from '../models/IngestDocument.js';
import { canalDeOperacion } from '../utils/canalOperacion.js';
import { revertirOperacion } from '../services/operationService.js';

const router = express.Router();

// All operation routes require authentication
router.use(requireAuth);

/**
 * GET /api/operations
 * Get all operations (history of imports/migrations)
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, status, limit = 50 } = req.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;

    const query = buildUserQuery(req, filters);
    const operations = await Operation.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .lean();

    // DAT-02: las operaciones viejas de la Bandeja se reconocen por el documento que las importó
    const documentos = await IngestDocument.find(buildUserQuery(req, { operation_id: { $in: operations.map(o => o.operation_id) } }))
      .select('operation_id fuente auto_importado')
      .lean();
    const porOperacion = new Map(documentos.map(d => [d.operation_id, d]));
    const data = operations.map(op => ({ ...op, ...canalDeOperacion(op, porOperacion.get(op.operation_id)) }));

    res.json({
      success: true,
      count: data.length,
      data
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

    const query = buildUserQuery(req, { operation_id: operationId });
    const operation = await Operation.findOne(query);

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Operación no encontrada'
      });
    }

    // Get sample transactions for this operation - user scoped
    const sampleTransactionQuery = buildUserQuery(req, { operation_id: operationId });
    const sampleTransactions = await Transaction.find(sampleTransactionQuery)
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

    // Find the operation - user scoped
    const query = buildUserQuery(req, { operation_id: operationId });
    const operation = await Operation.findOne(query);

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

    // Borra las transacciones, restaura contrapartes y, si vino de la Bandeja, reabre el documento
    const deleteResult = await revertirOperacion(req, operation);

    res.json({
      success: true,
      message: `Se eliminaron ${deleteResult.deletedCount} transacciones de la operación "${operation.filename}"`,
      data: {
        operation_id: operationId,
        deleted_count: deleteResult.deletedCount,
        reabierto: deleteResult.reabierto,
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
    const userFilter = buildUserQuery(req);
    
    const totalOperations = await Operation.countDocuments(userFilter);
    const completedOperations = await Operation.countDocuments(buildUserQuery(req, { status: 'completed' }));
    const rolledBackOperations = await Operation.countDocuments(buildUserQuery(req, { status: 'rolled_back' }));
    
    const operationsByType = await Operation.aggregate([
      { $match: userFilter },
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
