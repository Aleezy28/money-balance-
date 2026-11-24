import { Router } from 'express';
import {
  changePassword,
  getMe,
  login,
  logout,
  register,
  resetAccountData,
  sendVerification,
  updateProfile,
  verifyEmail,
} from '../controllers/authController.ts';
import { authMiddleware } from '../middleware/authMiddleware.ts';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmail);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);
router.put('/password', authMiddleware, changePassword);
router.post('/reset', authMiddleware, resetAccountData);

export default router;
