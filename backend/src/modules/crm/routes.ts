import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission, checkHotelAccess } from '../../middleware/permissions.js';
import { crmController } from './controller.js';

const router = Router();

// All CRM routes require authentication
router.use(authMiddleware);

// Hotels
router.get('/hotels', (req, res, next) => crmController.listHotels(req, res, next));
router.post('/hotels', requirePermission('hotels:write'), (req, res, next) =>
  crmController.createHotel(req, res, next)
);
router.get('/hotels/:hotel_id', checkHotelAccess(), (req, res, next) =>
  crmController.getHotel(req, res, next)
);

// Tasks
router.post('/hotels/:hotel_id/tasks', checkHotelAccess(), requirePermission('tasks:write'), (req, res, next) =>
  crmController.createTask(req, res, next)
);

// Task photos
router.post('/tasks/:task_id/photos', (req, res, next) =>
  crmController.uploadPhoto(req, res, next)
);

export default router;
