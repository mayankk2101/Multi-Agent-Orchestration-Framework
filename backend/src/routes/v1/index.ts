import { Router } from 'express';
import { optionalAuthMiddleware } from '../../middleware/auth.js';

import authRoutes from '../../modules/auth/routes.js';
import userRoutes from '../../modules/users/routes.js';
import crmRoutes from '../../modules/crm/routes.js';
import hotelWorkerRoutes from '../../modules/hotel-workers/routes.js';
import qualityRoutes from '../../modules/quality/routes.js';
import hrRoutes from '../../modules/hr/routes.js';
import staffingRoutes from '../../modules/staffing/routes.js';
import notificationRoutes from '../../modules/notifications/routes.js';
import analyticsRoutes from '../../modules/analytics/routes.js';
import calendarRoutes from '../../modules/calendar/routes.js';

const router = Router();

router.use(optionalAuthMiddleware);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/crm', crmRoutes);
router.use('/crm/hotels/:hotel_id/workers', hotelWorkerRoutes);
router.use('/quality', qualityRoutes);
router.use('/hr', hrRoutes);
router.use('/staffing', staffingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/calendar', calendarRoutes);

router.get('/status', (req, res) => {
  res.json({
    status: 'success',
    data: {
      message: 'Hotel CRM API v1 is running',
      version: '0.1.0',
      modules: ['auth', 'users', 'crm', 'hotel-workers', 'staffing', 'hr', 'calendar', 'notifications', 'analytics', 'quality'],
      environment: process.env.NODE_ENV || 'development',
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.requestId || 'unknown',
    },
  });
});

export default router;
