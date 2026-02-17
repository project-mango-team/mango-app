import express from 'express';
import {
  getStats,
  getGastosByCategoria,
  getMonthlySummary,
  getAvailableYears
} from '../controllers/statsController.js';

const router = express.Router();

router.get('/', getStats);
router.get('/categorias', getGastosByCategoria);
router.get('/monthly', getMonthlySummary);
router.get('/years', getAvailableYears);

export default router;
