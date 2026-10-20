import { AppError } from '../middleware/errorHandler.js';
import { listarSecretos, borrarSecreto } from '../services/secretService.js';

// Credenciales guardadas del usuario: solo metadatos, nunca el valor.
// Cada feature (por ejemplo MP-02) tiene su propio endpoint para cargar y probar su credencial.
export const getSecrets = async (req, res, next) => {
  try {
    res.json({ success: true, data: await listarSecretos(req.user._id) });
  } catch (error) {
    next(error);
  }
};

export const deleteSecret = async (req, res, next) => {
  try {
    if (!(await borrarSecreto(req.user._id, req.params.nombre))) {
      throw new AppError('Credencial no encontrada', 404);
    }
    res.json({ success: true, message: 'Credencial borrada' });
  } catch (error) {
    next(error);
  }
};
