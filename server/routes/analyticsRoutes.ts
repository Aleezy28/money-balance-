import { Router } from 'express';
import {
  getAccountingStatements,
  getAnalytics,
  getMonthlyReport,
  getWorkspaceAlerts,
} from '../controllers/analyticsController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(authMiddleware);

router.get('/', getAnalytics);
router.get('/report', getMonthlyReport);
router.get('/statements', getAccountingStatements);
router.get('/alerts', getWorkspaceAlerts);

export default router;
