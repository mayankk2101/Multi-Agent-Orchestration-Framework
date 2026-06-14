import { Request, Response, NextFunction } from 'express';
import { qualityService } from './service.js';

export class QualityController {
  async createVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await qualityService.createVerification(req.body);
      res.status(201).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async createRating(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new Error('Not authenticated');
      const result = await qualityService.createRating(req.body, {
        userId: req.auth.userId,
        role: req.auth.role,
      });
      res.status(201).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await qualityService.getLeaderboard(req.params.hotel_id || '');
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

export const qualityController = new QualityController();
