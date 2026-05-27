import { BaseService } from '../../lib/base-service.js';

/**
 * CRM Service - Hotels, Rooms, Tasks
 *
 * IMPORTANT: Implementation deferred to later phase
 * This is a skeleton for the modular monolith structure
 */
export class CrmService extends BaseService {
  async createHotel(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async getHotel(hotelId: string) {
    throw new Error('Not implemented');
  }

  async listHotels(filters?: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async createRoom(hotelId: string, data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async createTask(hotelId: string, data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async completeTask(taskId: string, userId: string) {
    throw new Error('Not implemented');
  }

  async uploadTaskPhoto(taskId: string, file: Buffer, metadata?: Record<string, unknown>) {
    throw new Error('Not implemented');
  }
}

export const crmService = new CrmService();
