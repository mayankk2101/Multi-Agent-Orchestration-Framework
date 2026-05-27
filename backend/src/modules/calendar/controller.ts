import { Request, Response, NextFunction } from 'express';
import { calendarService } from './service.js';

export class CalendarController {
  async getDailyOperations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await calendarService.getDailyOperations(
        req.params.hotel_id,
        req.query.date as string
      );
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async createDailyOperation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await calendarService.createDailyOperation(req.params.hotel_id, req.body);
      res.status(201).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
