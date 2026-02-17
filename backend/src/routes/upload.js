import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { MercadoPagoParser } from '../parsers/MercadoPagoParser.js';
import { SantanderParser } from '../parsers/SantanderParser.js';
import { DolarService } from '../services/dolarService.js';
import Transaction from '../models/Transaction.js';
import Operation from '../models/Operation.js';
import { addUserToTransactionData, addUserToOperationData, buildUserQuery } from '../utils/userQuery.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All upload routes require authentication
router.use(requireAuth);

// Helper function to ensure valid numbers
const safeNumber = (value) => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

// Configurar multer para manejar uploads en memoria
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Helper function to convert DD-MM-YYYY or DD/MM/YYYY to standardized format
const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  // Replace - with / for consistency
  return dateStr.replace(/-/g, '/');
};

// Helper function to extract month name from date
const getMonthName = (dateStr) => {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    return meses[month] || '';
  }
  return '';
};

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

    // Use SantanderParser to detect cards
    const parser = new SantanderParser(req.file.buffer, 1); // Dollar value not needed for detection
    const cards = parser.getCards();

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

    const { tipo, valorDolar, cardType, selectedCards } = req.body;

    if (!tipo || !['mercadopago', 'santander'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo inválido. Debe ser "mercadopago" o "santander"'
      });
    }

    let transactions = [];
    let parser;
    let cardFilter = null; // Declare at function scope

    // Parse based on type
    if (tipo === 'mercadopago') {
      parser = new MercadoPagoParser(req.file.buffer);
      transactions = await parser.parse();
    } else if (tipo === 'santander') {
      // Get dollar value (use provided or fetch from API)
      let dolarVal = parseFloat(valorDolar);
      if (!dolarVal || isNaN(dolarVal)) {
        dolarVal = await DolarService.getCotizacion();
      }
      
      // Parse selectedCards if provided as JSON string
      if (selectedCards) {
        try {
          cardFilter = typeof selectedCards === 'string' ? JSON.parse(selectedCards) : selectedCards;
        } catch (e) {
          cardFilter = selectedCards;
        }
      }
      
      parser = new SantanderParser(req.file.buffer, dolarVal, cardFilter);
      transactions = await parser.parse();
    }

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontraron transacciones válidas en el archivo'
      });
    }

    // Return transactions for preview/editing (don't save yet)
    res.json({
      success: true,
      message: `Se encontraron ${transactions.length} transacciones`,
      data: {
        filename: req.file.originalname,
        tipo,
        transactions,
        valorDolar: tipo === 'santander' ? (parseFloat(valorDolar) || await DolarService.getCotizacion()) : null,
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
    const { tipo, valorDolar, transactions: editedTransactions, filename, cardType, selectedCards } = req.body;

    let transactions = [];
    let sourceFilename = filename;

    // Check if we have pre-edited transactions (from editor)
    if (editedTransactions) {
      // Transactions sent from editor (either as string or already parsed)
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
    } else if (req.file) {
      // Legacy path: parse from uploaded file
      sourceFilename = req.file.originalname;

      if (!tipo || !['mercadopago', 'santander'].includes(tipo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de archivo inválido. Debe ser "mercadopago" o "santander"'
        });
      }

      let parser;
      let cardFilter = null; // Declare at function scope

      // Parse based on type
      if (tipo === 'mercadopago') {
        parser = new MercadoPagoParser(req.file.buffer);
        transactions = await parser.parse();
      } else if (tipo === 'santander') {
        // Get dollar value (use provided or fetch from API)
        let dolarVal = parseFloat(valorDolar);
        if (!dolarVal || isNaN(dolarVal)) {
          dolarVal = await DolarService.getCotizacion();
        }
        
        // Parse selectedCards if provided as JSON string
        if (selectedCards) {
          try {
            cardFilter = typeof selectedCards === 'string' ? JSON.parse(selectedCards) : selectedCards;
          } catch (e) {
            cardFilter = selectedCards;
          }
        }
        
        parser = new SantanderParser(req.file.buffer, dolarVal, cardFilter);
        transactions = await parser.parse();
      }
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

    // Generate unique operation ID for this import
    const operationId = uuidv4();
    const batchId = uuidv4();
    const timestamp = new Date();

    // Transform transactions to MongoDB format and save
    const transactionsToSave = addUserToTransactionData(req, transactions.map(t => ({
      fecha: normalizeDate(t.fecha),
      mes: getMonthName(normalizeDate(t.fecha)),
      categoria: t.categoria,
      detalle: t.detalle,
      importe: t.importe,
      moneda: t.moneda,
      monto_original: t.monto_original,
      tipo: t.tipo,
      origen: t.origen,
      operation_id: operationId,
      batch_id: batchId,
      batch_filename: sourceFilename,
      batch_timestamp: timestamp
    })));

    // Calculate totals
    const gastos = transactionsToSave.filter(t => t.tipo === 'Gasto').reduce((sum, t) => sum + (t.importe || 0), 0);
    const ingresos = transactionsToSave.filter(t => t.tipo === 'Ingreso').reduce((sum, t) => sum + (t.importe || 0), 0);

    // Insert transactions into MongoDB
    const result = await Transaction.insertMany(transactionsToSave, { ordered: false });

    // Create operation record with safe numeric values
    await Operation.create(addUserToOperationData(req, {
      operation_id: operationId,
      type: 'upload',
      status: 'completed',
      origen: transactions[0]?.origen || tipo,
      filename: sourceFilename,
      transactions_count: result.length,
      total_gastos: safeNumber(gastos),
      total_ingresos: safeNumber(ingresos),
      balance: safeNumber(ingresos - gastos),
      metadata: {
        batch_id: batchId,
        tipo,
        transacciones_procesadas: transactions.length
      },
      created_at: timestamp
    }));

    res.json({
      success: true,
      message: `Se importaron ${result.length} transacciones exitosamente`,
      data: {
        operation_id: operationId,
        batch_id: batchId,
        filename: sourceFilename,
        tipo,
        transacciones_procesadas: transactions.length,
        transacciones_guardadas: result.length,
        timestamp
      }
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
