import LoanMovement from '../models/LoanMovement.js';
import { CATEGORIA_PRESTAMO } from '../models/User.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { planDePrestamos } from '../utils/loanFromStatement.js';
import { fechaISO } from '../utils/investmentFromStatement.js';
import { DolarService } from './dolarService.js';

// Une las transferencias de un extracto con Préstamos (PUL-07): sugiere el préstamo o devolución en la vista previa,
// lo crea al guardar y lo revierte con la carga. Igual que INV: todo se recalcula en el servidor y se filtra por
// usuario; del cliente solo se toma el deudor elegido y si se tilda "registrar" (`prestamo.crear`).

const existentesDelUsuario = (req) => LoanMovement.find(buildUserQuery(req))
  .select('deudor tipo moneda fecha monto monto_usd transaction_id')
  .lean();

/**
 * Cotización del dólar (blue promedio) de cada fecha pedida, una sola consulta por fecha.
 * Si falla una fecha queda en 0 y el plan la marca como error.
 */
const cotizacionesDe = async (transacciones) => {
  const fechas = [...new Set(transacciones.map(t => fechaISO(t.fecha)).filter(Boolean))];
  const porFecha = new Map();
  await Promise.all(fechas.map(async (fecha) => {
    try {
      porFecha.set(fecha, (await DolarService.getBlue(fecha)).promedio);
    } catch {
      porFecha.set(fecha, 0);
    }
  }));
  return (fecha) => porFecha.get(fecha) ?? 0;
};

/**
 * Vista previa: agrega a cada transacción con `prestamo.deudor` lo que se registraría en Préstamos:
 * { deudor, tipo, monto, moneda, crear, duplicado: { fecha }|null, error }.
 * Las filas que ya estaban cargadas o que una regla ignora no se ofrecen.
 */
export const marcarPrestamosSugeridos = async (req, transactions) => {
  if (!transactions.some(t => t?.prestamo)) return transactions;
  const [existentes, cotizacion] = await Promise.all([
    existentesDelUsuario(req),
    cotizacionesDe(transactions.filter(t => t?.prestamo))
  ]);
  const plan = planDePrestamos(transactions, existentes, cotizacion);

  return transactions.map((t, i) => {
    const p = plan[i];
    if (!p) return t;
    const excluida = Boolean(t.duplicado || t.ignorada);
    return {
      ...t,
      prestamo: {
        deudor: p.deudor,
        tipo: p.movimiento?.tipo ?? null,
        monto: p.movimiento?.monto ?? null,
        moneda: p.movimiento?.moneda ?? t.moneda ?? 'ARS',
        crear: p.crear && !excluida,
        duplicado: p.duplicado,
        error: p.error
      }
    };
  });
};

/**
 * Al guardar: crea los préstamos/devoluciones de las transacciones con `prestamo.crear` (mejor esfuerzo: si algo
 * falla la importación ya está hecha y se avisa). Vuelve a calcular todo contra la base.
 * @param {Array<{ _id, categoria, prestamo?: { deudor, crear } }>} transacciones - guardadas, con su _id
 * @returns {Promise<null | { creados: number, duplicados: number, errores: string[] }>}
 */
export const crearPrestamosDeExtracto = async (req, transacciones, operationId) => {
  // Solo si la fila sigue siendo un Préstamo: si el usuario le cambió la categoría, ya no se registra
  const pedidas = transacciones.filter(t => t?.prestamo?.deudor && t.prestamo.crear === true && t.categoria === CATEGORIA_PRESTAMO);
  if (!pedidas.length) return null;

  const aviso = { creados: 0, duplicados: 0, errores: [] };
  try {
    const [existentes, cotizacion] = await Promise.all([existentesDelUsuario(req), cotizacionesDe(pedidas)]);
    const plan = planDePrestamos(pedidas, existentes, cotizacion);
    const docs = [];
    plan.forEach((p, i) => {
      if (p.error) aviso.errores.push(p.error);
      else if (p.duplicado) aviso.duplicados++;
      else if (p.crear) {
        const m = p.movimiento;
        docs.push({
          deudor: p.deudor,
          concepto: 'Desde el extracto',
          fecha: new Date(`${m.fecha}T00:00:00Z`),
          tipo: m.tipo,
          moneda: m.moneda,
          monto: m.monto,
          cotizacion_usd: cotizacion(m.fecha),
          monto_usd: m.monto_usd,
          origen: 'extracto',
          operation_id: operationId,
          transaction_id: pedidas[i]._id
        });
      }
    });
    if (docs.length) {
      const creados = await LoanMovement.insertMany(addUserToData(req, docs));
      aviso.creados = creados.length;
    }
  } catch (error) {
    console.error('[prestamos] no se pudieron crear los movimientos del extracto:', error.message);
    aviso.errores.push('No se pudieron registrar en Préstamos; cargalos a mano o revertí la carga y probá de nuevo');
  }
  return aviso;
};

/**
 * Al revertir una importación: se borran los préstamos que creó el extracto (solo del usuario y de esa operación)
 * @returns {Promise<{ borrados: number }>}
 */
export const revertirPrestamosDeOperacion = async (req, operationId) => {
  if (!operationId) return { borrados: 0 };
  const r = await LoanMovement.deleteMany(buildUserQuery(req, { operation_id: operationId, origen: 'extracto' }));
  return { borrados: r.deletedCount ?? 0 };
};

/**
 * Frase para sumar al mensaje de la importación
 */
export const textoAvisoPrestamos = (aviso) => {
  if (!aviso) return '';
  const partes = [];
  if (aviso.creados) partes.push(`Se registraron ${aviso.creados} movimiento${aviso.creados === 1 ? '' : 's'} en Préstamos`);
  if (aviso.duplicados) partes.push(`${aviso.duplicados} ya estaba${aviso.duplicados === 1 ? '' : 'n'} registrado${aviso.duplicados === 1 ? '' : 's'}`);
  if (aviso.errores?.length) partes.push(`No se pudo registrar en Préstamos: ${aviso.errores[0]}`);
  return partes.length ? `. ${partes.join('. ')}` : '';
};
