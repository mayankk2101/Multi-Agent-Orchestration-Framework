import { Request, Response, NextFunction } from 'express';
import { staffingService } from './service.js';

export class StaffingController {
  async createWorkRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffingService.createWorkRequest(req.body);
      res.status(201).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async assignWorkers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffingService.assignWorkers(req.params.work_request_id, req.body);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableWorkers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffingService.getAvailableWorkers(
        req.query.hotel_id as string,
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

  async startAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffingService.startAssignment(req.params.assignment_id);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  async completeAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await staffingService.completeAssignment(req.params.assignment_id);
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

export const staffingController = new StaffingController();
