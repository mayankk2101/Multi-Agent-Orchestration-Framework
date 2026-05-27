import { Router } from 'express';
import { optionalAuthMiddleware } from '../../middleware/auth.js';

// Import module routes
import authRoutes from '../../modules/auth/routes.js';
import crmRoutes from '../../modules/crm/routes.js';
import qualityRoutes from '../../modules/quality/routes.js';
import hrRoutes from '../../modules/hr/routes.js';
import staffingRoutes from '../../modules/staffing/routes.js';
import notificationRoutes from '../../modules/notifications/routes.js';
import analyticsRoutes from '../../modules/analytics/routes.js';
import calendarRoutes from '../../modules/calendar/routes.js';

const router = Router();

// Apply optional auth to all v1 routes
router.use(optionalAuthMiddleware);

// Module routes
router.use('/auth', authRoutes);
router.use('/crm', crmRoutes);
router.use('/quality', qualityRoutes);
router.use('/hr', hrRoutes);
router.use('/staffing', staffingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/calendar', calendarRoutes);

// API status endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'success',
    data: {
      message: 'Hotel CRM API v1 is running',
      version: '0.1.0',
      modules: [
        'auth',
        'crm',
        'staffing',
        'hr',
        'calendar',
        'notifications',
        'analytics',
        'quality',
      ],
      environment: process.env.NODE_ENV || 'development',
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: req.requestId || 'unknown',
    },
  });
});

export default router;
