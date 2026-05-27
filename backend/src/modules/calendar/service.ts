import { BaseService } from '../../lib/base-service.js';

export class CalendarService extends BaseService {
  async getDailyOperations(hotelId: string, date: string) {
    throw new Error('Not implemented');
  }

  async createDailyOperation(hotelId: string, data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }
}

export const calendarService = new CalendarService();
