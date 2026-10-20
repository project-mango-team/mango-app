import express from 'express';
import multer from 'multer';
import Transaction from '../models/Transaction.js';
import Operation from '../models/Operation.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { requireAuth } from '../middleware/auth.js';
import {
  parsearDocumento,
  guardarImportacion,
  detectarTarjetasSantander,
  detectarDocumento,
  hashArchivo,
  marcarDuplicados,
  buscarImportacionDelArchivo
} from '../services/statementImportService.js';
import { reabrirPorRollback } from '../services/ingestService.js';
import { nombreArchivo } from '../utils/uploadFilename.js';
import { reglasDelUsuario } from '../services/ruleService.js';

const router = express.Router();

// All upload routes require authentication
router.use(requireAuth);

// Configurar multer para manejar uploads en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

const archivoDe = (file) => ({ buffer: file.buffer, filename: nombreArchivo(file) });

/**
 * POST /api/upload/detect
 * Reconoce banco, tipo de resumen y tarjetas a partir del contenido del archivo
 */
router.post('/detect', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo'
      });
    }

    const data = await detectarDocumento(archivoDe(req.file));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload/detect-cards
 * Detect available cards in a Santander file
 */
router.post('/detect-cards', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo'
      });
    }

    const { cardType } = req.body; // 'visa' or 'amex'

    // For now, only Visa is supported
    if (cardType !== 'visa') {
      return res.json({
        success: true,
        data: {
          cards: []
        }
      });
    }

    const cards = await detectarTarjetasSantander(archivoDe(req.file));

    res.json({
      success: true,
      data: {
        cards,
        cardType
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload/preview
 * Parse file and return transactions without saving (for preview/editing)
 */
router.post('/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo'
      });
    }

    const { tipo, valorDolar, cardType, selectedCards, tipoResumen } = req.body;

    const { transactions, valorDolar: dolarUsado, cardFilter } = await parsearDocumento({
      ...archivoDe(req.file),
      tipo,
      tipoResumen,
      valorDolar,
      selectedCards,
      reglas: await reglasDelUsuario(req)
    });

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontraron transacciones válidas en el archivo'
      });
    }

    // Ya cargadas: por transacción (resúmenes superpuestos) y por archivo (el mismo subido dos veces)
    const sha256 = hashArchivo(req.file.buffer);
    const [conDuplicados, archivoYaImportado] = await Promise.all([
      marcarDuplicados(req, transactions),
      buscarImportacionDelArchivo(req, sha256)
    ]);

    // Return transactions for preview/editing (don't save yet)
    res.json({
      success: true,
      message: `Se encontraron ${transactions.length} transacciones`,
      data: {
        filename: nombreArchivo(req.file),
        tipo,
        transactions: conDuplicados,
        duplicados: conDuplicados.filter(t => t.duplicado).length,
        ignoradas: conDuplicados.filter(t => t.ignorada).length,
        sha256,
        archivoYaImportado,
        valorDolar: tipo === 'santander' ? dolarUsado : null,
        cardType: cardType || null,
        selectedCards: cardFilter || null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/upload
 * Save transactions to database
 * Can accept either a file (legacy) or pre-parsed transactions (new with editor)
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { tipo, valorDolar, transactions: editedTransactions, filename, selectedCards, tipoResumen } = req.body;
    let { sha256 } = req.body;

    let transactions = [];
    let sourceFilename = filename;

    // Check if we have pre-edited transactions (from editor or manual entry)
    if (editedTransactions) {
      // Transactions sent from editor or manual entry (either as string or already parsed)
      try {
        transactions = typeof editedTransactions === 'string'
          ? JSON.parse(editedTransactions)
          : editedTransactions;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Error al parsear las transacciones editadas'
        });
      }

      // For manual entry, set filename if not provided
      if (tipo === 'manual' && !sourceFilename) {
        sourceFilename = 'Carga Manual';
      }
    } else if (req.file) {
      // Legacy path: parse from uploaded file
      sourceFilename = nombreArchivo(req.file);
      sha256 = hashArchivo(req.file.buffer);

      ({ transactions } = await parsearDocumento({
        ...archivoDe(req.file),
        tipo,
        tipoResumen,
        valorDolar,
        selectedCards,
        reglas: await reglasDelUsuario(req)
      }));
      // Sin pasar por el editor, lo que una regla manda ignorar no se importa
      transactions = transactions.filter(t => !t.ignorada);
    } else {
      // No transactions or file provided
      return res.status(400).json({
        success: false,
        message: 'No se subió ningún archivo ni se enviaron transacciones'
      });
    }

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontraron transacciones válidas en el archivo'
      });
    }

    // Las marcas de la vista previa no se guardan
    transactions = transactions.map(({ duplicado, ignorada, regla, ...t }) => t);
    const data = await guardarImportacion({ req, transactions, tipo, filename: sourceFilename, sha256 });

    res.json({
      success: true,
      message: `Se importaron ${data.transacciones_guardadas} transacciones exitosamente`,
      data
    });
  } catch (error) {
    // Handle duplicate key errors (if transaction already exists)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Algunas transacciones ya existen en la base de datos',
        error: error.message
      });
    }

    next(error);
  }
});

// Get import history (batches)
router.get('/history', async (req, res, next) => {
  try {
    // Get operations of type 'upload' for current user
    const query = buildUserQuery(req, { type: 'upload' });
    const operations = await Operation.find(query)
      .sort({ created_at: -1 })
      .limit(20);

    res.json({
      success: true,
      data: operations.map(op => ({
        operation_id: op.operation_id,
        batch_id: op.metadata?.batch_id,
        filename: op.filename,
        timestamp: op.created_at,
        origen: op.origen,
        transacciones: op.transactions_count,
        total: op.total_gastos + op.total_ingresos,
        status: op.status
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Rollback an import (delete all transactions from a batch)
// Now uses operation_id but maintains compatibility with old batch_id parameter
router.delete('/rollback/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;

    // Try to find by operation_id first (new way), then by batch_id (old way) - user scoped
    let operation = await Operation.findOne(buildUserQuery(req, { operation_id: batchId }));
    
    if (!operation) {
      // Try finding by batch_id in metadata (backward compatibility) - user scoped
      operation = await Operation.findOne(buildUserQuery(req, { 'metadata.batch_id': batchId }));
    }

    if (!operation) {
      // Last resort: find transaction and get operation_id - user scoped
      const transaction = await Transaction.findOne(buildUserQuery(req, { 
        $or: [
          { operation_id: batchId },
          { batch_id: batchId }
        ]
      }));

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Operación no encontrada'
        });
      }

      // Get the operation - user scoped
      operation = await Operation.findOne(buildUserQuery(req, { operation_id: transaction.operation_id }));
    }

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

    // Delete all transactions with this operation_id - user scoped
    const deleteQuery = buildUserQuery(req, { operation_id: operation.operation_id });
    const result = await Transaction.deleteMany(deleteQuery);

    // Update operation status
    operation.status = 'rolled_back';
    operation.rolled_back_at = new Date();
    await operation.save();

    // Si vino de la bandeja, el documento vuelve a quedar para revisar
    await reabrirPorRollback(req, operation.operation_id);

    res.json({
      success: true,
      message: `Se eliminaron ${result.deletedCount} transacciones del lote ${operation.filename}`,
      data: {
        deleted_count: result.deletedCount,
        operation_id: operation.operation_id,
        batch_id: batchId,
        filename: operation.filename
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
