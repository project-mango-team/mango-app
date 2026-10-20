import { estadoCuenta, conectarCuenta, probarConexion, desconectarCuenta } from '../services/mercadoPagoCuentaService.js';

// Cuenta de Mercado Pago conectada (MP-02)

export const getCuenta = async (req, res, next) => {
  try {
    res.json({ success: true, data: await estadoCuenta(req.user._id) });
  } catch (error) {
    next(error);
  }
};

export const putToken = async (req, res, next) => {
  try {
    res.json({ success: true, data: await conectarCuenta(req.user._id, req.body?.token) });
  } catch (error) {
    next(error);
  }
};

export const postProbar = async (req, res, next) => {
  try {
    res.json({ success: true, data: await probarConexion(req.user._id) });
  } catch (error) {
    next(error);
  }
};

export const deleteCuenta = async (req, res, next) => {
  try {
    res.json({ success: true, data: await desconectarCuenta(req.user._id) });
  } catch (error) {
    next(error);
  }
};
