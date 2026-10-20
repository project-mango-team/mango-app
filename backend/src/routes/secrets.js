import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSecrets, deleteSecret } from '../controllers/secretController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getSecrets);
router.delete('/:nombre', deleteSecret);

export default router;
