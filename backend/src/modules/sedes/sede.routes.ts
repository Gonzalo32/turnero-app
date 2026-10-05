import { Router } from 'express';
import { requireRole } from '../../middlewares/auth.middleware';
import { handle } from '../../utils/handle';
import { sedeService } from './sede.service';

/** /api/v1/sedes — lectura para cualquier usuario autenticado, escritura solo admin. */
const router = Router();

router.get('/', handle((req) => sedeService.list(req.query['all'] === 'true' && !!req.user?.roles.includes('admin'))));
router.post('/', requireRole('admin'), handle((req) => sedeService.create(req.body), 'Sede creada', 201));
router.put('/:id', requireRole('admin'), handle((req) => sedeService.update(req.params['id'], req.body), 'Sede actualizada'));

export default router;
