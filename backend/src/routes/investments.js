import express from 'express';
import {
  getTypes,
  createType,
  deleteType,
  getAssets,
  getPortfolio,
  getPerformance,
  createValuations,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  getMovements,
  createMovement,
  updateMovement,
  deleteMovement
} from '../controllers/investmentController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.route('/types')
  .get(getTypes)
  .post(createType);

router.delete('/types/:nombre', deleteType);

router.get('/portfolio', getPortfolio);
router.get('/performance', getPerformance);
router.post('/valuations', createValuations);

router.route('/assets')
  .get(getAssets)
  .post(createAsset);

router.route('/assets/:id')
  .get(getAsset)
  .put(updateAsset)
  .delete(deleteAsset);

router.route('/assets/:id/movements')
  .get(getMovements)
  .post(createMovement);

router.route('/assets/:id/movements/:movId')
  .put(updateMovement)
  .delete(deleteMovement);

export default router;
