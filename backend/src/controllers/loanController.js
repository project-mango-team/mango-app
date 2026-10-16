import mongoose from 'mongoose';
import LoanMovement, { TIPOS_PRESTAMO, MONEDAS_PRESTAMO } from '../models/LoanMovement.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { DolarService } from '../services/dolarService.js';
import { parseFecha, parseMonto, parseCotizacion } from '../utils/inputParsers.js';
import { montoPrestamoUsd, saldoDeudor, resumirPrestamos } from '../utils/loanCalc.js';

const EPSILON = 0.005;

const usd = (n) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ordenarPorFechaDesc = (movimientos) =>
  [...movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || new Date(b.created_at) - new Date(a.created_at));

/**
 * Valida y arma un movimiento de préstamo. Si es una devolución, verifica que no supere el saldo del deudor.
 * @param {Object} body - Datos del request (completos al crear, parciales al editar)
 * @param {Object} [actual] - Movimiento existente (al editar)
 */
const armarMovimiento = async (req, body, actual = null) => {
  const datos = {
    deudor: body.deudor ?? actual?.deudor,
    concepto: body.concepto ?? actual?.concepto ?? '',
    tipo: body.tipo ?? actual?.tipo,
    moneda: body.moneda ?? actual?.moneda,
    monto: body.monto ?? actual?.monto
  };
  const fechaStr = body.fecha ?? actual?.fecha.toISOString().slice(0, 10);

  if (typeof datos.deudor !== 'string' || !datos.deudor.trim()) {
    throw new AppError('El deudor es obligatorio', 400);
  }
  datos.deudor = datos.deudor.trim();
  datos.concepto = String(datos.concepto).trim();
  if (!TIPOS_PRESTAMO.includes(datos.tipo)) {
    throw new AppError(`Tipo inválido. Opciones: ${TIPOS_PRESTAMO.join(', ')}`, 400);
  }
  if (!MONEDAS_PRESTAMO.includes(datos.moneda)) {
    throw new AppError(`Moneda inválida. Opciones: ${MONEDAS_PRESTAMO.join(', ')}`, 400);
  }
  datos.fecha = parseFecha(fechaStr);
  datos.monto = parseMonto(datos.monto);
  if (datos.monto === 0) {
    throw new AppError('El monto tiene que ser mayor a 0', 400);
  }

  // Si cambió la fecha y no mandaron cotización, se busca la del nuevo día
  const mismaFecha = actual && actual.fecha.toISOString().slice(0, 10) === fechaStr;
  datos.cotizacion_usd = parseCotizacion(body.cotizacion_usd, 'USD')
    ?? (mismaFecha ? actual.cotizacion_usd : (await DolarService.getBlue(fechaStr)).promedio);
  datos.monto_usd = montoPrestamoUsd(datos.monto, datos.moneda, datos.cotizacion_usd);

  if (datos.tipo === 'Devolucion') {
    const movimientos = await LoanMovement.find(buildUserQuery(req)).lean();
    const saldo = saldoDeudor(movimientos, datos.deudor, actual?._id);
    if (datos.monto_usd > saldo + EPSILON) {
      throw new AppError(
        `La devolución (${usd(datos.monto_usd)}) supera el saldo pendiente de ${datos.deudor} (${usd(Math.max(saldo, 0))})`,
        400
      );
    }
  }

  return datos;
};

const findMovimientoOrFail = async (req, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Movimiento no encontrado', 404);
  }
  const movimiento = await LoanMovement.findOne(buildUserQuery(req, { _id: id }));
  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404);
  }
  return movimiento;
};

// Resumen por deudor (pendientes y saldados) con sus movimientos y el total pendiente en USD y ARS
export const getLoans = async (req, res, next) => {
  try {
    const movimientos = await LoanMovement.find(buildUserQuery(req)).lean();
    const resumen = resumirPrestamos(movimientos);
    const cotizacion = movimientos.length ? (await DolarService.getBlue()).promedio : null;

    const conMovimientos = (d) => ({
      ...d,
      saldo_ars: cotizacion ? Math.round(d.saldo_usd * cotizacion) : 0,
      movimientos: ordenarPorFechaDesc(
        movimientos.filter(m => m.deudor.trim().toLowerCase() === d.deudor.trim().toLowerCase())
      )
    });

    res.json({
      success: true,
      data: {
        cotizacion_usd: cotizacion,
        total_pendiente_usd: resumen.total_pendiente_usd,
        total_pendiente_ars: cotizacion ? Math.round(resumen.total_pendiente_usd * cotizacion) : 0,
        pendientes: resumen.pendientes.map(conMovimientos),
        saldados: resumen.saldados.map(conMovimientos)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createLoanMovement = async (req, res, next) => {
  try {
    const datos = await armarMovimiento(req, req.body);
    const movimiento = await LoanMovement.create(addUserToData(req, datos));
    res.status(201).json({ success: true, data: movimiento });
  } catch (error) {
    next(error);
  }
};

export const updateLoanMovement = async (req, res, next) => {
  try {
    const movimiento = await findMovimientoOrFail(req, req.params.id);
    const datos = await armarMovimiento(req, req.body, movimiento);
    movimiento.set(datos);
    await movimiento.save();
    res.json({ success: true, data: movimiento });
  } catch (error) {
    next(error);
  }
};

export const deleteLoanMovement = async (req, res, next) => {
  try {
    const movimiento = await findMovimientoOrFail(req, req.params.id);
    await LoanMovement.deleteOne(buildUserQuery(req, { _id: movimiento._id }));
    res.json({ success: true, message: 'Movimiento eliminado' });
  } catch (error) {
    next(error);
  }
};
