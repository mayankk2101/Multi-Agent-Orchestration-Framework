import { Router } from 'express';
import { hotelWorkerController } from './controller.js';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission, requireRole, checkHotelAccess } from '../../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(checkHotelAccess());

router.get('/', requirePermission('hotel_workers:read'), ...hotelWorkerController.listWorkers);
router.post('/', requireRole(['admin', 'manager']), requirePermission('hotel_workers:write'), ...hotelWorkerController.assignWorker);
router.delete('/:worker_id', requireRole(['admin', 'manager']), (req, res, next) => hotelWorkerController.removeWorker(req, res, next));

export default router;
