import mongoose from 'mongoose';
import ApiToken from '../models/ApiToken.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildUserQuery, addUserToData } from '../utils/userQuery.js';
import { generarToken, hashToken, prefijoVisible } from '../utils/apiTokens.js';

const vista = (t) => ({
  _id: t._id,
  nombre: t.nombre,
  prefijo: t.prefijo,
  scopes: t.scopes,
  created_at: t.created_at,
  last_used_at: t.last_used_at || null
});

// Tokens activos del usuario (nunca se devuelve el token ni su hash)
export const getTokens = async (req, res, next) => {
  try {
    const tokens = await ApiToken.find(buildUserQuery(req, { revocado_at: { $exists: false } })).sort({ created_at: -1 }).lean();
    res.json({ success: true, data: tokens.map(vista) });
  } catch (error) {
    next(error);
  }
};

// Crea un token y lo devuelve completo por única vez
export const createToken = async (req, res, next) => {
  try {
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) {
      throw new AppError('Ponele un nombre al token (por ejemplo, "Script de Gmail")', 400);
    }
    const token = generarToken();
    const registro = await ApiToken.create(addUserToData(req, {
      nombre,
      hash: hashToken(token),
      prefijo: prefijoVisible(token),
      scopes: ['ingest']
    }));
    res.status(201).json({
      success: true,
      message: 'Copiá el token ahora: no se va a volver a mostrar',
      data: { ...vista(registro), token }
    });
  } catch (error) {
    next(error);
  }
};

export const revokeToken = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError('Token no encontrado', 404);
    }
    const registro = await ApiToken.findOneAndUpdate(
      buildUserQuery(req, { _id: req.params.id, revocado_at: { $exists: false } }),
      { revocado_at: new Date() },
      { new: true }
    );
    if (!registro) {
      throw new AppError('Token no encontrado', 404);
    }
    res.json({ success: true, message: 'Token revocado' });
  } catch (error) {
    next(error);
  }
};
