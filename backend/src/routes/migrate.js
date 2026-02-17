import express from 'express';
import multer from 'multer';
import { ExcelMigrator } from '../parsers/ExcelMigrator.js';
import Transaction from '../models/Transaction.js';
import Operation from '../models/Operation.js';

const router = express.Router();

// Helper function to ensure valid numbers
const safeNumber = (value) => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

// Configurar multer para manejar uploads en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max for large Excel files
});

/**
 * POST /api/migrate/preview
 * Upload Excel file and get preview of data (statistics only)
 */
router.post('/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo'
      });
    }

    // Validate file extension
    const filename = req.file.originalname.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser formato Excel (.xlsx o .xls)'
      });
    }

    // Initialize migrator and get preview
    const migrator = new ExcelMigrator(req.file.buffer);
    await migrator.initialize();

    const preview = migrator.getPreview();

    res.json({
      success: true,
      message: 'Preview generado exitosamente',
      data: {
        filename: req.file.originalname,
        preview
      }
    });
  } catch (error) {
    console.error('Error in preview:', error);
    next(error);
  }
});

/**
 * POST /api/migrate
 * Perform full migration of Excel data to MongoDB
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo'
      });
    }

    // Validate file extension
    const filename = req.file.originalname.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser formato Excel (.xlsx o .xls)'
      });
    }

    // Initialize migrator
    const migrator = new ExcelMigrator(req.file.buffer);
    await migrator.initialize();

    // Extract all transactions
    const { transactions, sheetStats } = migrator.extractAllTransactions();

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontraron transacciones en el archivo'
      });
    }

    // Add migration metadata
    const operationId = `migration_${Date.now()}`;
    const migrationId = operationId;
    const timestamp = new Date();

    const transactionsToSave = transactions.map(t => ({
      ...t,
      operation_id: operationId,
      migration_id: migrationId,
      migration_filename: req.file.originalname,
      migration_timestamp: timestamp,
      created_at: timestamp
    }));

    // Calculate summary
    const sheetsWithData = Object.values(sheetStats).filter(s => s !== null).length;
    const totalGastos = Object.values(sheetStats)
      .filter(s => s !== null)
      .reduce((sum, s) => sum + (s.importe_gastos || 0), 0);
    const totalIngresos = Object.values(sheetStats)
      .filter(s => s !== null)
      .reduce((sum, s) => sum + (s.importe_ingresos || 0), 0);

    // Bulk insert into MongoDB
    const result = await Transaction.insertMany(transactionsToSave, { 
      ordered: false // Continue on duplicate errors
    });

    // Create operation record with safe numeric values
    await Operation.create({
      operation_id: operationId,
      type: 'migration',
      status: 'completed',
      origen: 'Migración Excel',
      filename: req.file.originalname,
      transactions_count: result.length,
      total_gastos: safeNumber(totalGastos),
      total_ingresos: safeNumber(totalIngresos),
      balance: safeNumber(totalIngresos - totalGastos),
      metadata: {
        migration_id: migrationId,
        hojas_procesadas: sheetsWithData,
        sheet_stats: sheetStats
      },
      created_at: timestamp
    });

    res.json({
      success: true,
      message: `Migración exitosa: ${result.length} transacciones importadas de ${sheetsWithData} hojas`,
      data: {
        operation_id: operationId,
        migration_id: migrationId,
        filename: req.file.originalname,
        hojas_procesadas: sheetsWithData,
        transacciones_importadas: result.length,
        total_gastos: totalGastos,
        total_ingresos: totalIngresos,
        balance: totalIngresos - totalGastos,
        timestamp
      }
    });
  } catch (error) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Algunas transacciones ya existen en la base de datos. Verifica si ya migraste este archivo.',
        error: error.message
      });
    }

    console.error('Error in migration:', error);
    next(error);
  }
});

/**
 * GET /api/migrate/history
 * Get migration history (list of previous migrations)
 */
router.get('/history', async (req, res, next) => {
  try {
    // Get operations of type 'migration'
    const operations = await Operation.find({ type: 'migration' })
      .sort({ created_at: -1 })
      .limit(20);

    res.json({
      success: true,
      data: operations.map(op => ({
        operation_id: op.operation_id,
        migration_id: op.metadata?.migration_id || op.operation_id,
        filename: op.filename,
        timestamp: op.created_at,
        transacciones: op.transactions_count,
        total: op.total_gastos + op.total_ingresos,
        status: op.status
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/migrate/:migrationId
 * Rollback a migration (delete all transactions from a migration)
 */
router.delete('/:migrationId', async (req, res, next) => {
  try {
    const { migrationId } = req.params;

    // Try to find by operation_id first (new way), then by migration_id (old way)
    let operation = await Operation.findOne({ operation_id: migrationId });
    
    if (!operation) {
      // Try finding by migration_id in metadata (backward compatibility)
      operation = await Operation.findOne({ 'metadata.migration_id': migrationId });
    }

    if (!operation) {
      // Last resort: find transaction and get operation_id
      const transaction = await Transaction.findOne({ 
        $or: [
          { operation_id: migrationId },
          { migration_id: migrationId }
        ]
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Migración no encontrada'
        });
      }

      // Get the operation
      operation = await Operation.findOne({ operation_id: transaction.operation_id });
    }

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: 'Migración no encontrada'
      });
    }

    // Check if already rolled back
    if (operation.status === 'rolled_back') {
      return res.status(400).json({
        success: false,
        message: 'Esta migración ya fue revertida'
      });
    }

    // Delete all transactions with this operation_id
    const result = await Transaction.deleteMany({ operation_id: operation.operation_id });

    // Update operation status
    operation.status = 'rolled_back';
    operation.rolled_back_at = new Date();
    await operation.save();

    res.json({
      success: true,
      message: `Se eliminaron ${result.deletedCount} transacciones de la migración ${operation.filename}`,
      data: {
        deleted_count: result.deletedCount,
        operation_id: operation.operation_id,
        migration_id: migrationId,
        filename: operation.filename
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
