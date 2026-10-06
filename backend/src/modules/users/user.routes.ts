import { Router } from 'express';
import { requireRole } from '../../middlewares/auth.middleware';
import { listUsers, createUser, updateUser, setUserActive, resetUserPassword } from './user.controller';

/** /api/v1/users — solo administradores. requireAuth se aplica en app.ts. */
const router = Router();
router.use(requireRole('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/active', setUserActive);
router.post('/:id/reset-password', resetUserPassword);

export default router;
