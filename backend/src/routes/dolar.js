import express from 'express';
import { getCotizacion } from '../controllers/dolarController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/cotizacion', getCotizacion);

export default router;
