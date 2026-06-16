import { BaseService } from '../../lib/base-service.js';
import { NotImplementedError } from '../../lib/errors.js';

export class CalendarService extends BaseService {
  async getDailyOperations(_hotelId: string, _date: string) {
    throw new NotImplementedError('Calendar daily operations are not yet implemented');
  }

  async createDailyOperation(_hotelId: string, _data: Record<string, unknown>) {
    throw new NotImplementedError('Calendar daily operations are not yet implemented');
  }
}

export const calendarService = new CalendarService();
