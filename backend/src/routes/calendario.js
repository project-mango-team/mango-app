import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCalendario, putFuente, deleteFuente, putAutoImportar } from '../controllers/calendarioController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getCalendario);
router.put('/:fuente/auto-importar', putAutoImportar);
router.route('/:fuente').put(putFuente).delete(deleteFuente);

export default router;
