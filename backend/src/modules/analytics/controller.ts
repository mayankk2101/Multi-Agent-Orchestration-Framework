import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './service.js';

export class AnalyticsController {
  async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const hotelId = req.query.hotel_id as string | undefined;
      const result = await analyticsService.getLeaderboard(hotelId);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getDashboardStats(req.params.hotel_id);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async getHotelSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getHotelSummary(req.params.hotel_id);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
