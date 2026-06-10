import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission, requireRole, checkHotelAccess } from '../../middleware/permissions.js';
import { crmController } from './controller.js';

const router = Router();

router.use(authMiddleware);

// Hotels CRUD
router.get('/hotels', requirePermission('hotels:read'), ...crmController.listHotels);
router.post('/hotels', requireRole(['admin', 'manager']), requirePermission('hotels:write'), ...crmController.createHotel);
router.get('/hotels/:hotel_id', checkHotelAccess(), requirePermission('hotels:read'), (req, res, next) => crmController.getHotel(req, res, next));
router.put('/hotels/:hotel_id', checkHotelAccess(), requireRole(['admin', 'manager']), requirePermission('hotels:write'), ...crmController.updateHotel);
router.delete('/hotels/:hotel_id', requireRole('admin'), (req, res, next) => crmController.deleteHotel(req, res, next));

// Rooms
router.get('/hotels/:hotel_id/rooms', checkHotelAccess(), requirePermission('rooms:read'), ...crmController.listRooms);
router.post('/hotels/:hotel_id/rooms', checkHotelAccess(), requirePermission('rooms:write'), ...crmController.createRoom);
router.get('/hotels/:hotel_id/rooms/:room_id', checkHotelAccess(), requirePermission('rooms:read'), (req, res, next) => crmController.getRoom(req, res, next));
router.put('/hotels/:hotel_id/rooms/:room_id', checkHotelAccess(), requirePermission('rooms:write'), ...crmController.updateRoom);

// Tasks (placeholder)
router.post('/hotels/:hotel_id/tasks', checkHotelAccess(), requirePermission('tasks:write'), (req, res, next) =>
  crmController.uploadPhoto(req, res, next)
);

// Task photos (placeholder)
router.post('/tasks/:task_id/photos', (req, res, next) => crmController.uploadPhoto(req, res, next));

export default router;
