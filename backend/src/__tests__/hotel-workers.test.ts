import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockHotelWorker = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findFirst: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  upsert: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  count: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockPrisma = {
  hotel: { findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
  user: { findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
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

import { HotelWorkerService } from '../modules/hotel-workers/service.js';

const makeHwRow = (overrides = {}) => ({
  id: 'hw1',
  hotel_id: 'h1',
  worker_id: 'w1',
  position: 'cleaner',
  status: 'ACTIVE' as const,
  invited_at: new Date('2026-01-01T00:00:00Z'),
  joined_at: new Date('2026-01-02T00:00:00Z'),
  left_at: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('HotelWorkerService', () => {
  let service: HotelWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HotelWorkerService();
  });

  // ── enroll ────────────────────────────────────────────────────────────────

  describe('enroll', () => {
    const input = { worker_id: 'w1', position: 'cleaner' };

    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);
      await expect(service.enroll('bad_hotel', input, 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError', message: 'Hotel not found',
      });
    });

    it('throws NotFoundError when worker not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.enroll('h1', input, 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError', message: 'Worker not found',
      });
    });

    it('throws ConflictError when worker already enrolled and not REMOVED', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1' });
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'ACTIVE' }));
      await expect(service.enroll('h1', input, 'actor', 'admin')).rejects.toMatchObject({
        name: 'ConflictError',
      });
    });

    it('re-enrolls a REMOVED worker via upsert', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1' });
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'REMOVED' }));
      const row = makeHwRow({ status: 'INVITED', joined_at: null });
      mockHotelWorker.upsert.mockResolvedValue(row);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.enroll('h1', input, 'actor', 'manager');
      expect(mockHotelWorker.upsert).toHaveBeenCalled();
      expect(result.is_active).toBe(false); // INVITED → false
      expect(result.role).toBe('cleaner');
    });

    it('creates new enrollment and returns PATCH-05e DTO', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1' });
      mockHotelWorker.findUnique.mockResolvedValue(null);
      const row = makeHwRow({ status: 'INVITED', joined_at: null });
      mockHotelWorker.upsert.mockResolvedValue(row);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.enroll('h1', input, 'actor', 'manager');
      // PATCH-05e contract fields
      expect(result).toMatchObject({
        id: 'hw1',
        hotel_id: 'h1',
        worker_id: 'w1',
        role: 'cleaner',
        is_active: false,
      });
      expect(result).not.toHaveProperty('position');
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('hotel_ids');
      expect(typeof result.start_date).toBe('string');
      expect(typeof result.created_at).toBe('string');
    });
  });

  // ── listByHotel ───────────────────────────────────────────────────────────

  describe('listByHotel', () => {
    const query = { page: 1, per_page: 20, status: undefined, position: undefined };

    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);
      await expect(service.listByHotel('bad_hotel', query)).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('returns paginated PATCH-05e DTOs', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockHotelWorker.findMany.mockResolvedValue([makeHwRow()]);
      mockHotelWorker.count.mockResolvedValue(1);

      const result = await service.listByHotel('h1', query);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ role: 'cleaner', is_active: true });
      expect(result.data[0]).not.toHaveProperty('position');
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('throws NotFoundError when enrollment not found', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('h1', 'w1', 'ACTIVE' as any, 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('throws ConflictError on illegal transition (REMOVED → ACTIVE)', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'REMOVED' }));
      await expect(service.updateStatus('h1', 'w1', 'ACTIVE' as any, 'actor', 'admin')).rejects.toMatchObject({
        name: 'ConflictError',
      });
    });

    it('transitions INVITED → ACTIVE and sets joined_at', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'INVITED', joined_at: null }));
      const updated = makeHwRow({ status: 'ACTIVE' });
      mockHotelWorker.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateStatus('h1', 'w1', 'ACTIVE' as any, 'actor', 'manager');
      expect(result.is_active).toBe(true);
      const updateCall = mockHotelWorker.update.mock.calls[0] as any;
      expect(updateCall[0].data.joined_at).toBeInstanceOf(Date);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundError when enrollment not found', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(null);
      await expect(service.remove('h1', 'w1', 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('sets status REMOVED and left_at', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'ACTIVE' }));
      mockHotelWorker.update.mockResolvedValue(makeHwRow({ status: 'REMOVED', left_at: new Date() }));
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.remove('h1', 'w1', 'actor', 'manager');
      const updateCall = mockHotelWorker.update.mock.calls[0] as any;
      expect(updateCall[0].data.status).toBe('REMOVED');
      expect(updateCall[0].data.left_at).toBeInstanceOf(Date);
    });
  });

  // ── checkMembership ───────────────────────────────────────────────────────

  describe('checkMembership', () => {
    it('returns true when ACTIVE row exists', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'ACTIVE' }));
      expect(await service.checkMembership('h1', 'w1')).toBe(true);
    });

    it('returns false when status is SUSPENDED', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(makeHwRow({ status: 'SUSPENDED' }));
      expect(await service.checkMembership('h1', 'w1')).toBe(false);
    });

    it('returns false when no row exists', async () => {
      mockHotelWorker.findUnique.mockResolvedValue(null);
      expect(await service.checkMembership('h1', 'w1')).toBe(false);
    });
  });
});
