import ApiToken from '../models/ApiToken.js';
import User from '../models/User.js';
import { hashToken, tokenDesdeHeader, crearLimitador } from '../utils/apiTokens.js';

// 60 pedidos por minuto por token: un script que corre cada hora manda unos pocos
const permitir = crearLimitador({ max: 60, ventanaMs: 60 * 1000 });

// No escribir last_used_at en cada pedido
const ACTUALIZAR_USO_MS = 5 * 60 * 1000;

const noAutorizado = (res, message) => res.status(401).json({ success: false, message, code: 'INVALID_TOKEN' });

/**
 * Autenticación por token personal (Authorization: Bearer mango_...) para integraciones.
 * Setea req.user como el login con Google, así las rutas siguen usando buildUserQuery(req).
 * @param {string} scope - Permiso requerido (por ahora solo 'ingest')
 */
export const requireApiToken = (scope) => async (req, res, next) => {
  try {
    const token = tokenDesdeHeader(req.headers.authorization);
    if (!token) {
      return noAutorizado(res, 'Falta el token de integración (Authorization: Bearer mango_...)');
    }

    const registro = await ApiToken.findOne({ hash: hashToken(token), revocado_at: { $exists: false } });
    if (!registro || !registro.scopes.includes(scope)) {
      return noAutorizado(res, 'Token inválido o revocado');
    }

    if (!permitir(registro._id.toString())) {
      return res.status(429).json({ success: false, message: 'Demasiados pedidos con este token. Probá en un minuto.' });
    }

    const user = await User.findById(registro.user_id);
    if (!user) {
      return noAutorizado(res, 'Token inválido o revocado');
    }

    if (!registro.last_used_at || Date.now() - registro.last_used_at.getTime() > ACTUALIZAR_USO_MS) {
      registro.last_used_at = new Date();
      await registro.save();
    }

    req.user = user;
    req.apiToken = registro;
    next();
  } catch (error) {
    next(error);
  }
};
