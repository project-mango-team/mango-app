import mongoose from 'mongoose';
import InvestmentAsset from '../models/InvestmentAsset.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery } from '../utils/userQuery.js';
import { candidatasDeBackfill, cargarBackfill, textoAvisoInversiones } from '../services/investmentLinkService.js';

// INV-11: busca en los extractos ya cargados las transacciones 'Inversión' que las reglas mandan a este activo

const activoDelUsuario = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Activo no encontrado', 404);
  const asset = await InvestmentAsset.findOne(buildUserQuery(req, { _id: req.params.id })).lean();
  if (!asset) throw new AppError('Activo no encontrado', 404);
  return asset;
};

/**
 * POST /api/investments/assets/:id/backfill/preview
 * Qué se cargaría, sin guardar nada
 */
export const previewBackfill = async (req, res, next) => {
  try {
    const asset = await activoDelUsuario(req);
    const data = await candidatasDeBackfill(req, asset);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/investments/assets/:id/backfill   body: { transaction_ids: [...] }
 */
export const aplicarBackfill = async (req, res, next) => {
  try {
    const asset = await activoDelUsuario(req);
    const ids = req.body?.transaction_ids;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError('Elegí al menos una transacción', 400);
    if (ids.length > 2000) throw new AppError('Se pueden cargar hasta 2000 por vez', 400);
    const data = await cargarBackfill(req, asset, ids.filter(id => mongoose.isValidObjectId(id)));
    res.json({
      success: true,
      message: `${data.creados ? `Se cargaron ${data.creados} movimiento${data.creados === 1 ? '' : 's'} en ${asset.nombre}` : 'No se cargó ningún movimiento'}${textoAvisoInversiones({ ...data, creados: 0 })}`,
      data
    });
  } catch (error) {
    next(error);
  }
};
