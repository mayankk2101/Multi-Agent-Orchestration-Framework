import { BaseService } from '../../lib/base-service.js';
import { SignupRequest, LoginRequest, RefreshTokenRequest } from './types.js';

/**
 * Auth Service
 *
 * Handles:
 * - User registration
 * - User login
 * - Token refresh
 * - Password management
 * - Session management
 *
 * IMPORTANT: Implementation deferred to later phase
 * This is a skeleton for the modular monolith structure
 */
export class AuthService extends BaseService {
  async signup(data: SignupRequest) {
    // TODO: Implement signup
    throw new Error('Not implemented');
  }

  async login(data: LoginRequest) {
    // TODO: Implement login
    throw new Error('Not implemented');
  }

  async refreshToken(data: RefreshTokenRequest) {
    // TODO: Implement refresh token
    throw new Error('Not implemented');
  }

  async logout(userId: string) {
    // TODO: Implement logout
    throw new Error('Not implemented');
  }

  async getCurrentUser(userId: string) {
    // TODO: Implement get current user
    throw new Error('Not implemented');
  }

  async updateProfile(userId: string, data: Record<string, unknown>) {
    // TODO: Implement update profile
    throw new Error('Not implemented');
  }
}

export const authService = new AuthService();
