import { Router } from 'express';
import { getAiStatus, parseTransactionWithGroq } from '../controllers/aiController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();

router.use(authMiddleware);

router.get('/status', getAiStatus);
router.post('/parse-transaction', parseTransactionWithGroq);

export default router;
