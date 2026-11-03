import InvestmentMovement from '../models/InvestmentMovement.js';
import { buildUserQuery } from '../utils/userQuery.js';

/**
 * Al revertir una importación (INV-02), los movimientos de Inversiones que creó el extracto:
 * - sin cuotapartes: se borran, porque solo existen por esa transacción;
 * - con cuotapartes (el usuario ya las completó con el importador de Fima): se conservan y se
 *   desvinculan (vuelven a 'app'), porque ya tienen datos que no vienen del extracto.
 * Todo filtrado por usuario y por la operación.
 * @returns {Promise<{ borrados: number, desvinculados: number }>}
 */
export const revertirMovimientosDeOperacion = async (req, operationId) => {
  if (!operationId) return { borrados: 0, desvinculados: 0 };
  const deDeLaOperacion = { operation_id: operationId, origen: 'extracto' };

  const borrados = await InvestmentMovement.deleteMany(buildUserQuery(req, {
    ...deDeLaOperacion,
    $or: [{ unidades: { $exists: false } }, { unidades: null }]
  }));
  const desvinculados = await InvestmentMovement.updateMany(
    buildUserQuery(req, deDeLaOperacion),
    { $unset: { operation_id: 1, transaction_id: 1 }, $set: { origen: 'app' } }
  );
  return { borrados: borrados.deletedCount ?? 0, desvinculados: desvinculados.modifiedCount ?? 0 };
};
