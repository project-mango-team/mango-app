import { obtenerCalendario, guardarConfigFuente, borrarConfigFuente } from '../services/calendarioService.js';

export const getCalendario = async (req, res, next) => {
  try {
    res.json({ success: true, data: await obtenerCalendario(req) });
  } catch (error) {
    next(error);
  }
};

export const putFuente = async (req, res, next) => {
  try {
    res.json({ success: true, data: await guardarConfigFuente(req, req.params.fuente, req.body || {}) });
  } catch (error) {
    next(error);
  }
};

export const deleteFuente = async (req, res, next) => {
  try {
    res.json({ success: true, data: await borrarConfigFuente(req, req.params.fuente) });
  } catch (error) {
    next(error);
  }
};
