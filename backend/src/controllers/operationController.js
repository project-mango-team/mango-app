import Operation from '../models/Operation.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { parsearPaginacion } from '../utils/paginacion.js';

const CAMPOS = 'fecha detalle categoria importe tipo moneda monto_original';

/**
 * GET /api/operations/:operationId/transactions?limit=&skip=
 * Los ítems que importó una carga. La operación y las transacciones se buscan siempre por usuario.
 */
export const getTransaccionesDeOperacion = async (req, res, next) => {
  try {
    const { operationId } = req.params;
    if (typeof operationId !== 'string') throw new AppError('Operación no encontrada', 404);
    const { limit, skip } = parsearPaginacion(req.query, { porDefecto: 100, maximo: 200 });

    const operacion = await Operation.findOne(buildUserQuery(req, { operation_id: operationId }))
      .select('operation_id filename status origen transactions_count')
      .lean();
    if (!operacion) throw new AppError('Operación no encontrada', 404);

    const filtro = buildUserQuery(req, { operation_id: operationId });
    const [transactions, total] = await Promise.all([
      // Orden del archivo (_id), nunca por fecha: es un string
      Transaction.find(filtro).select(CAMPOS).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      data: { operation: operacion, transactions, total, hasMore: skip + transactions.length < total }
    });
  } catch (error) {
    next(error);
  }
};
