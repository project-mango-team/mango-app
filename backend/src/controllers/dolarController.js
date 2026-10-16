import { DolarService } from '../services/dolarService.js';
import { AppError } from '../middleware/errorHandler.js';

// Get current dollar rate used as default for card imports
export const getCotizacion = async (req, res, next) => {
  try {
    const data = await DolarService.getCotizacionDetalle();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validarFechaQuery = (fecha) => {
  if (fecha !== undefined && !FECHA_REGEX.test(fecha)) {
    throw new AppError('La fecha debe tener formato YYYY-MM-DD', 400);
  }
};

// Dólar blue (promedio compra/venta) usado para inversiones. ?fecha=YYYY-MM-DD opcional
export const getBlue = async (req, res, next) => {
  try {
    validarFechaQuery(req.query.fecha);
    const data = await DolarService.getBlue(req.query.fecha);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Euro oficial (promedio compra/venta) usado para inversiones. ?fecha=YYYY-MM-DD opcional
export const getEuro = async (req, res, next) => {
  try {
    validarFechaQuery(req.query.fecha);
    const data = await DolarService.getEuro(req.query.fecha);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
