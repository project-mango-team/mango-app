import express from 'express';
import {
  getLoans,
  createLoanMovement,
  updateLoanMovement,
  deleteLoanMovement
} from '../controllers/loanController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.route('/')
  .get(getLoans)
  .post(createLoanMovement);

router.route('/:id')
  .put(updateLoanMovement)
  .delete(deleteLoanMovement);

export default router;
