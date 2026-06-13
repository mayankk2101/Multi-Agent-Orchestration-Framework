import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission, requireRole, checkHotelAccess } from '../../middleware/permissions.js';
import { crmController } from './controller.js';

const router = Router();

router.use(authMiddleware);

// Hotels CRUD
router.get('/hotels', requireRole(['admin', 'manager']), requirePermission('hotels:read'), ...crmController.listHotels);
router.post('/hotels', requireRole(['admin', 'manager']), requirePermission('hotels:write'), ...crmController.createHotel);
router.get('/hotels/:hotel_id', checkHotelAccess(), requirePermission('hotels:read'), (req, res, next) => crmController.getHotel(req, res, next));
router.patch('/hotels/:hotel_id', checkHotelAccess(), requireRole(['admin', 'manager']), requirePermission('hotels:write'), ...crmController.updateHotel);
router.delete('/hotels/:hotel_id', requireRole('admin'), (req, res, next) => crmController.deleteHotel(req, res, next));

export default router;
