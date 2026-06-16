import { BaseService } from '../../lib/base-service.js';
import { NotImplementedError } from '../../lib/errors.js';

export class HrService extends BaseService {
  async createContract(_data: Record<string, unknown>) {
    throw new NotImplementedError('HR contracts are not yet implemented');
  }

  async listContracts(_filters?: Record<string, unknown>) {
    throw new NotImplementedError('HR contracts are not yet implemented');
  }

  async createPayroll(_data: Record<string, unknown>) {
    throw new NotImplementedError('HR payroll is not yet implemented');
  }

  async listPayroll(_filters?: Record<string, unknown>) {
    throw new NotImplementedError('HR payroll is not yet implemented');
  }

  async uploadDocument(_workerId: string, _file: Buffer, _metadata?: Record<string, unknown>) {
    throw new NotImplementedError('HR document upload is not yet implemented');
  }
}

export const hrService = new HrService();
