import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getTokens, createToken, revokeToken } from '../controllers/tokenController.js';

const router = express.Router();

router.use(requireAuth);

router.route('/')
  .get(getTokens)
  .post(createToken);

router.delete('/:id', revokeToken);

export default router;
