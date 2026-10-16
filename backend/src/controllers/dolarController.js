import { DolarService } from '../services/dolarService.js';

// Get current dollar rate used as default for card imports
export const getCotizacion = async (req, res, next) => {
  try {
    const data = await DolarService.getCotizacionDetalle();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
