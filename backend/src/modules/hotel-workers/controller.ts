import { Request, Response, NextFunction } from 'express';
import { hotelWorkerService } from './service.js';
import { AssignWorkerSchema, ListHotelWorkersQuerySchema } from './types.js';
import { validateBody, validateQuery } from '../../middleware/validation.js';
import { UnauthorizedError } from '../../lib/errors.js';

export class HotelWorkerController {
  listWorkers = [
    validateQuery(ListHotelWorkersQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const result = await hotelWorkerService.listHotelWorkers(req.params['hotel_id']!, req.query as never);
        res.status(200).json({
          status: 'success',
          data: result.workers,
          pagination: result.pagination,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  assignWorker = [
    validateBody(AssignWorkerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const worker = await hotelWorkerService.assignWorker(
          req.params['hotel_id']!,
          req.body.worker_id,
          req.auth.userId,
          req.auth.role,
          req.ip,
        );
        res.status(201).json({
          status: 'success',
          data: worker,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  async removeWorker(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new UnauthorizedError();
      await hotelWorkerService.removeWorker(
        req.params['hotel_id']!,
        req.params['worker_id']!,
        req.auth.userId,
        req.auth.role,
        req.ip,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const hotelWorkerController = new HotelWorkerController();
