import { esAdmin } from '../utils/admin.js';

// Usar después de requireAuth
export const requireAdmin = (req, res, next) => {
  if (!esAdmin(req.user?.email)) {
    return res.status(403).json({
      success: false,
      message: 'Solo un administrador puede ver esto',
      code: 'FORBIDDEN'
    });
  }
  next();
};
