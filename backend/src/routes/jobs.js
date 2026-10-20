import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { getJobs, runJob } from '../controllers/jobController.js';

const router = express.Router();

// Los jobs son de toda la instancia, no de un usuario: solo los ven los administradores
router.use(requireAuth, requireAdmin);

router.get('/', getJobs);
router.post('/:nombre/run', runJob);

export default router;
