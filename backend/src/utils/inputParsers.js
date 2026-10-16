import { AppError } from '../middleware/errorHandler.js';
import { hoyArgentina } from '../services/dolarService.js';

// Validación de inputs compartida por inversiones y préstamos

/**
 * Valida una fecha YYYY-MM-DD (no futura) y la devuelve como Date UTC a medianoche
 */
export const parseFecha = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new AppError('La fecha debe tener formato YYYY-MM-DD', 400);
  }
  const date = new Date(`${fecha}T00:00:00Z`);
  if (isNaN(date) || date.toISOString().slice(0, 10) !== fecha) {
    throw new AppError('Fecha inválida', 400);
  }
  if (fecha > hoyArgentina()) {
    throw new AppError('La fecha no puede ser futura', 400);
  }
  return date;
};

export const parseMonto = (monto) => {
  const n = Number(monto);
  if (monto === '' || monto === null || monto === undefined || !Number.isFinite(n) || n < 0) {
    throw new AppError('El monto debe ser un número mayor o igual a 0', 400);
  }
  return n;
};

export const parseCotizacion = (valor, nombre) => {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`La cotización ${nombre} debe ser un número mayor a 0`, 400);
  }
  return n;
};
