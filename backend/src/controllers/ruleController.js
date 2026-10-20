import {
  reglasDelUsuario,
  crearRegla,
  actualizarRegla,
  eliminarRegla,
  reordenarReglas
} from '../services/ruleService.js';

export const getReglas = async (req, res, next) => {
  try {
    res.json({ success: true, data: await reglasDelUsuario(req) });
  } catch (error) {
    next(error);
  }
};

export const createRegla = async (req, res, next) => {
  try {
    const regla = await crearRegla(req, req.body);
    res.status(201).json({ success: true, message: 'Regla creada', data: regla });
  } catch (error) {
    next(error);
  }
};

export const updateRegla = async (req, res, next) => {
  try {
    const regla = await actualizarRegla(req, req.params.id, req.body);
    res.json({ success: true, message: 'Regla actualizada', data: regla });
  } catch (error) {
    next(error);
  }
};

export const deleteRegla = async (req, res, next) => {
  try {
    await eliminarRegla(req, req.params.id);
    res.json({ success: true, message: 'Regla eliminada' });
  } catch (error) {
    next(error);
  }
};

export const reorderReglas = async (req, res, next) => {
  try {
    res.json({ success: true, data: await reordenarReglas(req, req.body.ids) });
  } catch (error) {
    next(error);
  }
};
