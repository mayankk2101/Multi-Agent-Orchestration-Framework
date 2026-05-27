import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { checkHotelAccess } from '../../middleware/permissions.js';
import { calendarController } from './controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/hotels/:hotel_id/operations', checkHotelAccess(), (req, res, next) =>
  calendarController.getDailyOperations(req, res, next)
);
router.post('/hotels/:hotel_id/operations', checkHotelAccess(), (req, res, next) =>
  calendarController.createDailyOperation(req, res, next)
);

export default router;
