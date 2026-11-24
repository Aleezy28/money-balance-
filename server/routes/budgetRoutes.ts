import { Router } from 'express';
import {
  deleteBudget,
  getBudgets,
  upsertBudget,
} from '../controllers/budgetController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(authMiddleware);

router.get('/', getBudgets);
router.post('/', upsertBudget);
router.delete('/:id', deleteBudget);

export default router;
