import { Request, Response, NextFunction } from 'express';
import { HotelWorkerService } from './service.js';
import { EnrollWorkerSchema, ListWorkersQuerySchema } from './types.js';
import { ValidationError } from '../../lib/errors.js';

const service = new HotelWorkerService();

export async function listWorkers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = ListWorkersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ValidationError('Invalid query parameters', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
      return;
    }
    const { data, total } = await service.listByHotel(req.params.hotel_id, parsed.data);
    const { page, per_page } = parsed.data;
    res.status(200).json({
      status: 'success',
      data,
      pagination: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
        has_next: page * per_page < total,
        has_prev: page > 1,
      },
      meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
    });
  } catch (error) {
    next(error);
  }
}

export async function enrollWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = EnrollWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError('Invalid request body', parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))));
      return;
    }
    const result = await service.enroll(
      req.params.hotel_id,
      parsed.data,
      req.auth!.userId,
      req.auth!.role
    );
    res.status(201).json({
      status: 'success',
      data: result,
      meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.remove(
      req.params.hotel_id,
      req.params.worker_id,
      req.auth!.userId,
      req.auth!.role
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
