import { BaseService } from '../../lib/base-service.js';

export class QualityService extends BaseService {
  async createVerification(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async createRating(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async getLeaderboard(hotelId: string) {
    throw new Error('Not implemented');
  }
}

export const qualityService = new QualityService();
