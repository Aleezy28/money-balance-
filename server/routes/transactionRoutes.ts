import { Router } from 'express';
import {
  createTransaction,
  deleteTransaction,
  exportCsv,
  getTransactions,
  importCsv,
  updateTransaction,
} from '../controllers/transactionController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(authMiddleware);

router.get('/export/csv', exportCsv);
router.post('/import/csv', importCsv);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
