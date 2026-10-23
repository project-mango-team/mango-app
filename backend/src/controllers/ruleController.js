import {
  reglasDelUsuario,
  crearRegla,
  actualizarRegla,
  eliminarRegla,
  reordenarReglas,
  coincidenciasDeRegla,
  aplicarReglaACargadas,
  deshacerAplicacion
} from '../services/ruleService.js';
import { patronDeDetalle } from '../utils/ruleLearning.js';

export const getReglas = async (req, res, next) => {
  try {
    res.json({ success: true, data: await reglasDelUsuario(req) });
  } catch (error) {
    next(error);
  }
};

export const createRegla = async (req, res, next) => {
  try {
    // Las que nacen de corregir una transacción (REV-03) quedan marcadas como aprendidas
    const creadaPor = req.body.creada_por === 'aprendida' ? 'aprendida' : 'usuario';
    const regla = await crearRegla(req, req.body, { creadaPor });
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

// Texto sugerido para una regla a partir del detalle de una transacción
export const getPatron = (req, res) => {
  res.json({ success: true, data: { texto: patronDeDetalle(req.query.detalle) } });
};

export const getCoincidencias = async (req, res, next) => {
  try {
    res.json({ success: true, data: await coincidenciasDeRegla(req, req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const aplicarRegla = async (req, res, next) => {
  try {
    const data = await aplicarReglaACargadas(req, req.params.id);
    res.json({ success: true, message: `Se actualizaron ${data.modificadas} transacciones`, data });
  } catch (error) {
    next(error);
  }
};

export const deshacerRegla = async (req, res, next) => {
  try {
    const data = await deshacerAplicacion(req, req.body.cambios);
    res.json({ success: true, message: 'Cambios deshechos', data });
  } catch (error) {
    next(error);
  }
};
