import { BaseService } from '../../lib/base-service.js';

export class AnalyticsService extends BaseService {
  async getLeaderboard(hotelId?: string) {
    throw new Error('Not implemented');
  }

  async getDashboardStats(hotelId: string) {
    throw new Error('Not implemented');
  }

  async getHotelSummary(hotelId: string) {
    throw new Error('Not implemented');
  }
}

export const analyticsService = new AnalyticsService();
