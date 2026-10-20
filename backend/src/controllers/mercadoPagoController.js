import { estadoCuenta, conectarCuenta, probarConexion, desconectarCuenta, errorDeMercadoPago } from '../services/mercadoPagoCuentaService.js';
import { sincronizarUsuario, estadoSyncDeUsuario, DEPS_REALES } from '../services/mercadoPagoSyncService.js';
import { mensajeDeSync } from '../utils/mercadoPagoSync.js';

// Cuenta de Mercado Pago conectada (MP-02) y sync (MP-03)

export const getCuenta = async (req, res, next) => {
  try {
    const cuenta = await estadoCuenta(req.user._id);
    const sync = cuenta.conectado ? await estadoSyncDeUsuario(req.user._id) : null;
    res.json({ success: true, data: { ...cuenta, sync } });
  } catch (error) {
    next(error);
  }
};

// Sync manual desde Configuración: no espera el reporte (el request quedaría colgado minutos)
export const postSincronizar = async (req, res, next) => {
  try {
    const resultado = await sincronizarUsuario(req.user._id, { ...DEPS_REALES, esperas: 0 });
    res.json({ success: true, data: { ...resultado, mensaje: mensajeDeSync(resultado) } });
  } catch (error) {
    next(errorDeMercadoPago(error));
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
