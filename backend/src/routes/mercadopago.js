import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCuenta, putToken, postProbar, deleteCuenta, postSincronizar } from '../controllers/mercadoPagoController.js';

const router = express.Router();

router.use(requireAuth);

router.route('/cuenta')
  .get(getCuenta)
  .put(putToken)
  .delete(deleteCuenta);

router.post('/cuenta/probar', postProbar);
router.post('/sincronizar', postSincronizar);

export default router;
