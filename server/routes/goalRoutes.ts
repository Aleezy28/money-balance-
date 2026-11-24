import { Router } from 'express';
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  getGoals,
  updateGoal,
} from '../controllers/goalController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(authMiddleware);

router.get('/', getGoals);
router.post('/', createGoal);
router.put('/:id', updateGoal);
router.post('/:id/contribute', contributeToGoal);
router.delete('/:id', deleteGoal);

export default router;
