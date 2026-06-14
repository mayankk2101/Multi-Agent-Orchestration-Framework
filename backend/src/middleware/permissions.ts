import { Request, Response, NextFunction } from 'express';
import { HotelWorkerStatus } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getPrisma } from '../lib/db.js';

export function requirePermission(permissions: string | string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = req.auth.permissions || [];

    // Check if user has admin:* or super_admin role (implicit all permissions)
    if (req.auth.role === 'super_admin' || userPermissions.includes('admin:*')) {
      logger.info('Permission check allowed by role', {
        userId: req.auth.userId,
        role: req.auth.role,
        required: requiredPermissions,
        requestId: req.requestId,
      });
      next();
      return;
    }

    // Check if user has all required permissions
    const hasPermission = requiredPermissions.every((permission) => {
      return (
        userPermissions.includes(permission) ||
        // Check for wildcard permissions (e.g., "users:*" covers "users:read")
        userPermissions.some((userPerm) => {
          const [userResource] = userPerm.split(':');
          const [requiredResource] = permission.split(':');
          return userPerm.endsWith(':*') && userResource === requiredResource;
        })
      );
    });

    if (!hasPermission) {
      logger.warn('Permission check denied', {
        userId: req.auth.userId,
        role: req.auth.role,
        required: requiredPermissions,
        userPermissions,
        requestId: req.requestId,
      });
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    logger.info('Permission check allowed', {
      userId: req.auth.userId,
      role: req.auth.role,
      required: requiredPermissions,
      requestId: req.requestId,
    });

    next();
  };
}

export function requireRole(roles: string | string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const hasRole = requiredRoles.includes(req.auth.role);

    if (!hasRole) {
      logger.warn('Role check denied', {
        userId: req.auth.userId,
        role: req.auth.role,
        required: requiredRoles,
        requestId: req.requestId,
      });
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    logger.info('Role check allowed', {
      userId: req.auth.userId,
      role: req.auth.role,
      requestId: req.requestId,
    });

    next();
  };
}

export function checkHotelAccess() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    // Admins, managers, and checkers bypass hotel membership check (PATCH-04 §4c).
    // Checkers are quality staff that operate across hotels and are not on the worker roster.
    if (req.auth.role === 'admin' || req.auth.role === 'manager' || req.auth.role === 'checker') {
      next();
      return;
    }

    const hotelId = req.params.hotel_id || req.query.hotel_id || req.body?.hotel_id;

    if (!hotelId) {
      logger.warn('Hotel scope check: no hotel_id provided', {
        userId: req.auth.userId,
        role: req.auth.role,
        requestId: req.requestId,
      });
      next(new ForbiddenError('Hotel ID is required'));
      return;
    }

    try {
      const prisma = getPrisma();
      const membership = await prisma.hotelWorker.findFirst({
        where: {
          hotel_id: hotelId as string,
          worker_id: req.auth.userId,
          status: HotelWorkerStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!membership) {
        logger.warn('Hotel scope check denied', {
          userId: req.auth.userId,
          role: req.auth.role,
          requestedHotel: hotelId,
          requestId: req.requestId,
        });
        next(new ForbiddenError(`Cannot access hotel ${hotelId}`));
        return;
      }

      logger.debug('Hotel scope check allowed', {
        userId: req.auth.userId,
        role: req.auth.role,
        hotelId,
        requestId: req.requestId,
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
