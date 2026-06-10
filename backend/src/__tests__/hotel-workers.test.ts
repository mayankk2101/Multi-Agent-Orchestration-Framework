import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockPrisma = {
  hotel: { findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
  user: {
    findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    count: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  },
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

describe('HotelWorkerService', () => {
  let service: HotelWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HotelWorkerService();
  });

  describe('assignWorker', () => {
    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1', hotel_ids: [], deleted_at: null });

      await expect(service.assignWorker('bad_hotel', 'w1', 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
        message: 'Hotel not found',
      });
    });

    it('throws NotFoundError when worker not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assignWorker('h1', 'bad_worker', 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
        message: 'Worker not found',
      });
    });

    it('throws ConflictError when worker already assigned', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1', hotel_ids: ['h1'], deleted_at: null });

      await expect(service.assignWorker('h1', 'w1', 'actor', 'admin')).rejects.toMatchObject({
        name: 'ConflictError',
      });
    });

    it('assigns worker successfully', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1', hotel_ids: [], deleted_at: null });
      mockPrisma.user.update.mockResolvedValue({
        id: 'w1',
        email: 'worker@test.com',
        first_name: 'W',
        last_name: 'O',
        role: 'WORKER',
        hotel_ids: ['h1'],
        is_active: true,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.assignWorker('h1', 'w1', 'actor', 'manager');
      expect(result.hotel_ids).toContain('h1');
      expect(result.role).toBe('worker');
    });
  });

  describe('removeWorker', () => {
    it('throws NotFoundError when worker not in hotel', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1', hotel_ids: ['h2'], deleted_at: null });

      await expect(service.removeWorker('h1', 'w1', 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
        message: 'Worker is not assigned to this hotel',
      });
    });

    it('removes worker from hotel', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'w1', hotel_ids: ['h1', 'h2'], deleted_at: null });
      mockPrisma.user.update.mockResolvedValue({
        id: 'w1',
        email: 'worker@test.com',
        first_name: 'W',
        last_name: 'O',
        role: 'WORKER',
        hotel_ids: ['h2'],
        is_active: true,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.removeWorker('h1', 'w1', 'actor', 'manager');
      expect(result.hotel_ids).not.toContain('h1');
      expect(result.hotel_ids).toContain('h2');
    });
  });

  describe('listHotelWorkers', () => {
    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);

      await expect(
        service.listHotelWorkers('bad_hotel', { page: 1, limit: 20, role: undefined, search: undefined, is_active: undefined })
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('returns paginated workers for hotel', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'w1', email: 'w@t.com', first_name: 'W', last_name: 'O', phone: null, role: 'WORKER', is_active: true, created_at: new Date() },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listHotelWorkers('h1', { page: 1, limit: 20, role: undefined, search: undefined, is_active: undefined });
      expect(result.workers).toHaveLength(1);
      expect(result.workers[0]?.role).toBe('worker');
    });
  });
});
