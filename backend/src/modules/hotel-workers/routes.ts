import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { checkHotelAccess, requireRole } from '../../middleware/permissions.js';
import { listWorkers, enrollWorker, removeWorker } from './controller.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(checkHotelAccess());

router.get('/', requireRole(['admin', 'manager']), listWorkers);
router.post('/', requireRole(['admin', 'manager']), enrollWorker);
router.delete('/:worker_id', requireRole(['admin', 'manager']), removeWorker);

export default router;
