import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getReglas, createRegla, updateRegla, deleteRegla, reorderReglas } from '../controllers/ruleController.js';

// Montado en /api/categories/reglas (desde routes/categories.js)
const router = express.Router();

router.use(requireAuth);

router.route('/')
  .get(getReglas)
  .post(createRegla);

router.put('/orden', reorderReglas);

router.route('/:id')
  .put(updateRegla)
  .delete(deleteRegla);

export default router;
