import { BaseService } from '../../lib/base-service.js';

export class StaffingService extends BaseService {
  async createWorkRequest(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async assignWorkers(workRequestId: string, data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async getAvailableWorkers(hotelId: string, date: string) {
    throw new Error('Not implemented');
  }

  async startAssignment(assignmentId: string) {
    throw new Error('Not implemented');
  }

  async completeAssignment(assignmentId: string) {
    throw new Error('Not implemented');
  }
}

export const staffingService = new StaffingService();
