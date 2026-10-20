import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getReglas,
  createRegla,
  updateRegla,
  deleteRegla,
  reorderReglas,
  getPatron,
  getCoincidencias,
  aplicarRegla,
  deshacerRegla
} from '../controllers/ruleController.js';

// Montado en /api/categories/reglas (desde routes/categories.js)
const router = express.Router();

router.use(requireAuth);

router.route('/')
  .get(getReglas)
  .post(createRegla);

router.put('/orden', reorderReglas);
router.get('/patron', getPatron);
router.post('/deshacer', deshacerRegla);

router.route('/:id')
  .put(updateRegla)
  .delete(deleteRegla);

// Aplicar una regla a las transacciones ya cargadas (REV-03)
router.get('/:id/coincidencias', getCoincidencias);
router.post('/:id/aplicar', aplicarRegla);

export default router;
