import express from 'express';
import {
  getTransactions,
  getTransaction,
  createTransactions,
  updateTransaction,
  deleteTransaction,
  deleteTransactions
} from '../controllers/transactionController.js';

const router = express.Router();

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
