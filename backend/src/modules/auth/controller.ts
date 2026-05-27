import { Request, Response, NextFunction } from 'express';
import { authService } from './service.js';
import { SignupRequest, LoginRequest } from './types.js';

/**
 * Auth Controller
 *
 * Handles HTTP requests for:
 * - POST /api/v1/auth/signup
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 * - GET /api/v1/auth/me
 * - PUT /api/v1/auth/profile
 *
 * IMPORTANT: Implementation deferred to later phase
 */
export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement signup endpoint
      // 1. Validate request body with Zod schema
      // 2. Call authService.signup()
      // 3. Return 201 with auth response
      const data = req.body as SignupRequest;
      const result = await authService.signup(data);
      res.status(201).json({
        status: 'success',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement login endpoint
      const data = req.body as LoginRequest;
      const result = await authService.login(data);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement refresh token endpoint
      const result = await authService.refreshToken(req.body);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement logout endpoint
      if (!req.auth) throw new Error('Not authenticated');
      await authService.logout(req.auth.userId);
      res.status(200).json({
        status: 'success',
        data: { message: 'Logged out successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement get current user endpoint
      if (!req.auth) throw new Error('Not authenticated');
      const user = await authService.getCurrentUser(req.auth.userId);
      res.status(200).json({
        status: 'success',
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: Implement update profile endpoint
      if (!req.auth) throw new Error('Not authenticated');
      const result = await authService.updateProfile(req.auth.userId, req.body);
      res.status(200).json({
        status: 'success',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
