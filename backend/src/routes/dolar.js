import express from 'express';
import { getCotizacion, getBlue, getEuro } from '../controllers/dolarController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/cotizacion', getCotizacion);
router.get('/blue', getBlue);
router.get('/euro', getEuro);

export default router;
