import { Router } from 'express';
import { authController } from './auth.controller';

const router = Router();

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

export default router;
