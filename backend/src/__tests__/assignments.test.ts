import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockWorkerAssignment = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  count: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockHotelWorker = {
  findFirst: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockPrisma = {
  workerAssignment: mockWorkerAssignment,
  hotelWorker: mockHotelWorker,
  auditLog: { create: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
};

jest.mock('../lib/db.js', () => ({ getPrisma: () => mockPrisma }));
jest.mock('../config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-secret-key-minimum-32-characters-long',
    JWT_ACCESS_EXPIRY: '1h',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
  }),
  loadEnv: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
}));

import { AssignmentService } from '../modules/assignments/service.js';

const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1',
  work_request_id: 'wr1',
  worker_id: 'w1',
  hotel_id: 'h1',
  assigned_by_id: 'mgr1',
  application_id: 'app1',
  status: 'CONFIRMED' as const,
  confirmed_at: new Date('2026-06-01T00:00:00Z'),
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  previous_assignment_id: null,
  updated_at: new Date('2026-06-01T00:00:00Z'),
  ...overrides,
});

describe('AssignmentService', () => {
  let service: AssignmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AssignmentService();
  });

  describe('update', () => {
    it('throws NotFoundError for unknown assignment', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.update('a1', { status: 'IN_PROGRESS' }, 'mgr1', 'manager')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('rejects illegal transition COMPLETED -> IN_PROGRESS', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment({ status: 'COMPLETED' }));
      await expect(service.update('a1', { status: 'IN_PROGRESS' }, 'mgr1', 'manager')).rejects.toMatchObject({
        name: 'ConflictError',
      });
    });

    it('transitions CONFIRMED -> IN_PROGRESS and sets started_at', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment());
      mockWorkerAssignment.update.mockResolvedValue(makeAssignment({ status: 'IN_PROGRESS', started_at: new Date() }));
      await service.update('a1', { status: 'IN_PROGRESS' }, 'w1', 'worker');
      const data = mockWorkerAssignment.update.mock.calls[0][0].data;
      expect(data.status).toBe('IN_PROGRESS');
      expect(data.started_at).toBeInstanceOf(Date);
    });

    it('transitions IN_PROGRESS -> COMPLETED and sets completed_at', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment({ status: 'IN_PROGRESS' }));
      mockWorkerAssignment.update.mockResolvedValue(makeAssignment({ status: 'COMPLETED', completed_at: new Date() }));
      await service.update('a1', { status: 'COMPLETED' }, 'w1', 'worker');
      const data = mockWorkerAssignment.update.mock.calls[0][0].data;
      expect(data.status).toBe('COMPLETED');
      expect(data.completed_at).toBeInstanceOf(Date);
    });

    it('cancels with reason and sets cancelled_at', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment());
      mockWorkerAssignment.update.mockResolvedValue(makeAssignment({ status: 'CANCELLED' }));
      await service.update('a1', { status: 'CANCELLED', cancellation_reason: 'sick' }, 'mgr1', 'manager');
      const data = mockWorkerAssignment.update.mock.calls[0][0].data;
      expect(data.status).toBe('CANCELLED');
      expect(data.cancelled_at).toBeInstanceOf(Date);
      expect(data.cancellation_reason).toBe('sick');
    });
  });

  describe('list', () => {
    it('scopes worker to own assignments', async () => {
      mockWorkerAssignment.findMany.mockResolvedValue([makeAssignment()]);
      mockWorkerAssignment.count.mockResolvedValue(1);
      await service.list({ page: 1, per_page: 20 } as any, { userId: 'w1', role: 'worker' });
      const where = mockWorkerAssignment.findMany.mock.calls[0][0].where;
      expect(where.worker_id).toBe('w1');
    });

    it('does not scope admin', async () => {
      mockWorkerAssignment.findMany.mockResolvedValue([]);
      mockWorkerAssignment.count.mockResolvedValue(0);
      await service.list({ page: 1, per_page: 20 } as any, { userId: 'a1', role: 'admin' });
      const where = mockWorkerAssignment.findMany.mock.calls[0][0].where;
      expect(where.worker_id).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('throws NotFoundError for missing assignment', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.getById('a1', { userId: 'w1', role: 'worker' })).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('allows worker to view own assignment', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment({ worker_id: 'w1' }));
      const dto = await service.getById('a1', { userId: 'w1', role: 'worker' });
      expect(dto.id).toBe('a1');
    });

    it('throws ForbiddenError when worker tries to view another\'s assignment with no roster', async () => {
      mockWorkerAssignment.findUnique.mockResolvedValue(makeAssignment({ worker_id: 'w2' }));
      mockHotelWorker.findFirst.mockResolvedValue(null);
      await expect(service.getById('a1', { userId: 'w1', role: 'worker' })).rejects.toMatchObject({
        name: 'ForbiddenError',
      });
    });
  });
});
