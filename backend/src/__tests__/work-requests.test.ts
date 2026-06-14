import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockWorkRequest = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  count: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  create: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockHotelWorker = {
  findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findFirst: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockPrisma = {
  hotel: { findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
  workRequest: mockWorkRequest,
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

import { WorkRequestService } from '../modules/work-requests/service.js';

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'wr1',
  hotel_id: 'h1',
  created_by_id: 'mgr1',
  position: 'cleaner',
  workers_needed: 2,
  workers_confirmed: 0,
  version: 0,
  shift_date: new Date('2026-07-01T00:00:00Z'),
  shift_start_time: '08:00',
  shift_end_time: '16:00',
  hourly_rate: null,
  currency: 'EUR',
  description: null,
  requirements: null,
  status: 'DRAFT' as const,
  published_at: null,
  expires_at: null,
  filled_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: new Date('2026-06-01T00:00:00Z'),
  updated_at: new Date('2026-06-01T00:00:00Z'),
  ...overrides,
});

const baseInput = {
  hotel_id: 'h1',
  position: 'cleaner',
  workers_needed: 2,
  shift_date: '2026-07-01',
  shift_start_time: '08:00',
  shift_end_time: '16:00',
  currency: 'EUR',
  status: 'DRAFT' as const,
};

describe('WorkRequestService', () => {
  let service: WorkRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkRequestService();
  });

  describe('create', () => {
    it('throws NotFoundError when hotel does not exist', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);
      await expect(service.create(baseInput, 'mgr1', 'manager')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('creates a DRAFT request without publishing', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1', deleted_at: null });
      mockWorkRequest.create.mockResolvedValue(makeRow());
      const dto = await service.create(baseInput, 'mgr1', 'manager');
      expect(dto.status).toBe('DRAFT');
      expect(dto.shift_date).toBe('2026-07-01');
      const data = mockWorkRequest.create.mock.calls[0][0].data;
      expect(data.status).toBe('DRAFT');
      expect(data.published_at).toBeNull();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('sets published_at when created directly as OPEN', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1', deleted_at: null });
      mockWorkRequest.create.mockResolvedValue(makeRow({ status: 'OPEN', published_at: new Date() }));
      await service.create({ ...baseInput, status: 'OPEN' }, 'mgr1', 'manager');
      const data = mockWorkRequest.create.mock.calls[0][0].data;
      expect(data.status).toBe('OPEN');
      expect(data.published_at).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('rejects an illegal status transition', async () => {
      mockWorkRequest.findUnique.mockResolvedValue(makeRow({ status: 'OPEN' }));
      await expect(
        service.update('wr1', { status: 'DRAFT' }, 'mgr1', 'manager')
      ).rejects.toMatchObject({ name: 'ConflictError' });
    });

    it('publishes a DRAFT (DRAFT -> OPEN) and bumps version', async () => {
      mockWorkRequest.findUnique.mockResolvedValue(makeRow({ status: 'DRAFT' }));
      mockWorkRequest.update.mockResolvedValue(makeRow({ status: 'OPEN' }));
      await service.update('wr1', { status: 'OPEN' }, 'mgr1', 'manager');
      const data = mockWorkRequest.update.mock.calls[0][0].data;
      expect(data.status).toBe('OPEN');
      expect(data.published_at).toBeInstanceOf(Date);
      expect(data.version).toEqual({ increment: 1 });
    });

    it('cancels with a reason', async () => {
      mockWorkRequest.findUnique.mockResolvedValue(makeRow({ status: 'OPEN' }));
      mockWorkRequest.update.mockResolvedValue(makeRow({ status: 'CANCELLED' }));
      await service.update('wr1', { status: 'CANCELLED', cancellation_reason: 'no demand' }, 'mgr1', 'manager');
      const data = mockWorkRequest.update.mock.calls[0][0].data;
      expect(data.status).toBe('CANCELLED');
      expect(data.cancelled_at).toBeInstanceOf(Date);
      expect(data.cancellation_reason).toBe('no demand');
    });

    it('does not edit terms once the request is OPEN', async () => {
      mockWorkRequest.findUnique.mockResolvedValue(makeRow({ status: 'OPEN' }));
      mockWorkRequest.update.mockResolvedValue(makeRow({ status: 'OPEN' }));
      await service.update('wr1', { position: 'supervisor' }, 'mgr1', 'manager');
      const data = mockWorkRequest.update.mock.calls[0][0].data;
      expect(data.position).toBeUndefined();
    });
  });

  describe('list', () => {
    it('scopes a worker to their active rosters', async () => {
      mockHotelWorker.findMany.mockResolvedValue([{ hotel_id: 'h1' }, { hotel_id: 'h2' }]);
      mockWorkRequest.findMany.mockResolvedValue([makeRow()]);
      mockWorkRequest.count.mockResolvedValue(1);
      await service.list(
        { page: 1, per_page: 20 } as any,
        { userId: 'w1', role: 'worker' }
      );
      const where = mockWorkRequest.findMany.mock.calls[0][0].where;
      expect(where.hotel_id).toEqual({ in: ['h1', 'h2'] });
    });

    it('returns empty for a worker with no active roster', async () => {
      mockHotelWorker.findMany.mockResolvedValue([]);
      const res = await service.list(
        { page: 1, per_page: 20 } as any,
        { userId: 'w1', role: 'worker' }
      );
      expect(res).toEqual({ data: [], total: 0 });
      expect(mockWorkRequest.findMany).not.toHaveBeenCalled();
    });

    it('does not scope an admin', async () => {
      mockWorkRequest.findMany.mockResolvedValue([]);
      mockWorkRequest.count.mockResolvedValue(0);
      await service.list({ page: 1, per_page: 20 } as any, { userId: 'a1', role: 'admin' });
      const where = mockWorkRequest.findMany.mock.calls[0][0].where;
      expect(where.hotel_id).toBeUndefined();
      expect(mockHotelWorker.findMany).not.toHaveBeenCalled();
    });
  });
});
