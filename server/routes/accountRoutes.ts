import { Router } from 'express';
import {
  createAccount,
  deleteAccount,
  getAccountLedger,
  getAccounts,
  updateAccount,
} from '../controllers/accountController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();
router.use(authMiddleware);

router.get('/', getAccounts);
router.get('/:id/ledger', getAccountLedger);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
