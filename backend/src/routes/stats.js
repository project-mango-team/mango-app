import express from 'express';
import {
  getStats,
  getGastosByCategoria,
  getMonthlySummary,
  getAvailableYears
} from '../controllers/statsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All stats routes require authentication 
router.use(requireAuth);

router.get('/', getStats);
router.get('/categorias', getGastosByCategoria);
router.get('/monthly', getMonthlySummary);
router.get('/years', getAvailableYears);

export default router;
