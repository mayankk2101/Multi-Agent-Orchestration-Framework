import { Request, Response, NextFunction } from 'express';
import { crmService } from './service.js';
import {
  CreateHotelSchema, UpdateHotelSchema,
  CreateRoomSchema, UpdateRoomSchema,
  ListHotelsQuerySchema, ListRoomsQuerySchema,
} from './types.js';
import { validateBody, validateQuery } from '../../middleware/validation.js';
import { UnauthorizedError } from '../../lib/errors.js';

export class CrmController {
  listHotels = [
    validateQuery(ListHotelsQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const result = await crmService.listHotels(req.query as never, req.auth.role);
        res.status(200).json({
          status: 'success',
          data: result.hotels,
          pagination: result.pagination,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  async getHotel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const hotel = await crmService.getHotel(req.params['hotel_id']!, req.auth.userId, req.auth.role, req.ip);
      res.status(200).json({
        status: 'success',
        data: hotel,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  createHotel = [
    validateBody(CreateHotelSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const hotel = await crmService.createHotel(req.body, req.auth.userId, req.auth.role, req.ip);
        res.status(201).json({
          status: 'success',
          data: hotel,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  updateHotel = [
    validateBody(UpdateHotelSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const hotel = await crmService.updateHotel(req.params['hotel_id']!, req.body, req.auth.userId, req.auth.role, req.ip);
        res.status(200).json({
          status: 'success',
          data: hotel,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  async deleteHotel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new UnauthorizedError();
      await crmService.deleteHotel(req.params['hotel_id']!, req.auth.userId, req.auth.role, req.ip);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // Rooms
  listRooms = [
    validateQuery(ListRoomsQuerySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const result = await crmService.listRooms(req.params['hotel_id']!, req.query as never);
        res.status(200).json({
          status: 'success',
          data: result.rooms,
          pagination: result.pagination,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  async getRoom(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const room = await crmService.getRoom(req.params['hotel_id']!, req.params['room_id']!);
      res.status(200).json({
        status: 'success',
        data: room,
        meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  }

  createRoom = [
    validateBody(CreateRoomSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const room = await crmService.createRoom(req.params['hotel_id']!, req.body, req.auth.userId, req.auth.role, req.ip);
        res.status(201).json({
          status: 'success',
          data: room,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

  updateRoom = [
    validateBody(UpdateRoomSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new UnauthorizedError();
        const room = await crmService.updateRoom(req.params['hotel_id']!, req.params['room_id']!, req.body, req.auth.userId, req.auth.role, req.ip);
        res.status(200).json({
          status: 'success',
          data: room,
          meta: { timestamp: new Date().toISOString(), request_id: req.requestId },
        });
      } catch (error) {
        next(error);
      }
    },
  ];

}

export const crmController = new CrmController();
