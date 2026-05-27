import { BaseService } from '../../lib/base-service.js';

export class HrService extends BaseService {
  async createContract(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async listContracts(filters?: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async createPayroll(data: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async listPayroll(filters?: Record<string, unknown>) {
    throw new Error('Not implemented');
  }

  async uploadDocument(workerId: string, file: Buffer, metadata?: Record<string, unknown>) {
    throw new Error('Not implemented');
  }
}

export const hrService = new HrService();
