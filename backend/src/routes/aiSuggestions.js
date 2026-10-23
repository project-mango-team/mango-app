import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { estadoSugerencias, cambiarSugerencias, sugerirCategorias } from '../services/aiSuggestionService.js';

// Montado en /api/categories/sugerencias (desde routes/categories.js). REV-06
const router = express.Router();

router.use(requireAuth);

router.get('/estado', async (req, res, next) => {
  try {
    res.json({ success: true, data: await estadoSugerencias(req) });
  } catch (error) {
    next(error);
  }
});

router.put('/estado', async (req, res, next) => {
  try {
    res.json({ success: true, data: await cambiarSugerencias(req, req.body.activo) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await sugerirCategorias(req, req.body.transacciones) });
  } catch (error) {
    next(error);
  }
});

export default router;
