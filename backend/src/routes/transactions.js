import express from 'express';
import {
  getTransactions,
  getTransaction,
  createTransactions,
  updateTransaction,
  deleteTransaction,
  deleteTransactions
} from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All transaction routes require authentication
router.use(requireAuth);

router.route('/')
  .get(getTransactions)
  .post(createTransactions);

router.route('/bulk-delete')
  .post(deleteTransactions);

router.route('/:id')
  .get(getTransaction)
  .put(updateTransaction)
  .delete(deleteTransaction);

export default router;
