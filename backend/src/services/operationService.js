import Transaction from '../models/Transaction.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { restaurarContrapartes } from './statementImportService.js';
import { reabrirPorRollback } from './ingestService.js';
import { revertirMovimientosDeOperacion } from './investmentLinkService.js';
import { revertirPrestamosDeOperacion } from './loanLinkService.js';

/**
 * Revierte una operación del usuario: borra sus transacciones, devuelve las contrapartes internas
 * a su categoría, la marca `rolled_back` y, si vino de la Bandeja, reabre el documento.
 * El reabrir va al final y no tira: las transacciones ya se borraron, así que un fallo del
 * reparseo no tiene que convertirse en un error de la reversión.
 * @returns {Promise<{ deletedCount: number, reabierto: boolean, inversiones: { borrados: number, desvinculados: number } }>}
 */
export const revertirOperacion = async (req, operation) => {
  const resultado = await Transaction.deleteMany(buildUserQuery(req, { operation_id: operation.operation_id }));
  // REV-04: las contrapartes marcadas como internas al importar vuelven a su categoría
  await restaurarContrapartes(req, operation);
  // INV-02: los movimientos de Inversiones que creó el extracto se borran (o se desvinculan si ya tienen cuotapartes)
  const inversiones = await revertirMovimientosDeOperacion(req, operation.operation_id);
  // PUL-07: los préstamos que creó el extracto se borran
  const prestamos = await revertirPrestamosDeOperacion(req, operation.operation_id);

  operation.status = 'rolled_back';
  operation.rolled_back_at = new Date();
  await operation.save();

  let reabierto = true;
  try {
    await reabrirPorRollback(req, operation.operation_id);
  } catch (error) {
    reabierto = false;
    console.error('No se pudo reabrir el documento de la Bandeja tras el rollback:', error.message);
  }
  return { deletedCount: resultado.deletedCount, reabierto, inversiones, prestamos };
};
