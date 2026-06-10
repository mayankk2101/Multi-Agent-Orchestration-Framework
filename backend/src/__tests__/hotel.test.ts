import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockPrisma = {
  hotel: {
    findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    create: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    count: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  },
  room: {
    findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    findFirst: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    create: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
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

import { CrmService } from '../modules/crm/service.js';

describe('CrmService - Hotels', () => {
  let service: CrmService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrmService();
  });

  describe('listHotels', () => {
    it('returns paginated hotels for admin', async () => {
      const fakeHotels = [
        { id: 'h1', name: 'Grand Hotel', city: 'Berlin', country: 'Germany', address: 'Street 1', timezone: 'Europe/Berlin', is_active: true, created_at: new Date(), updated_at: new Date(), _count: { rooms: 10 } },
      ];
      mockPrisma.hotel.findMany.mockResolvedValue(fakeHotels);
      mockPrisma.hotel.count.mockResolvedValue(1);

      const result = await service.listHotels({ page: 1, limit: 20, country: undefined, search: undefined, is_active: undefined }, 'admin');

      expect(result.hotels).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('only shows active hotels for workers', async () => {
      mockPrisma.hotel.findMany.mockResolvedValue([]);
      mockPrisma.hotel.count.mockResolvedValue(0);

      await service.listHotels({ page: 1, limit: 20, country: undefined, search: undefined, is_active: undefined }, 'worker');

      const findManyCall = (mockPrisma.hotel.findMany as jest.Mock).mock.calls[0] as Array<{ where: { is_active?: boolean } }>;
      expect(findManyCall[0]?.where.is_active).toBe(true);
    });
  });

  describe('createHotel', () => {
    it('creates and returns a hotel', async () => {
      const fake = { id: 'h1', name: 'Test Hotel', city: 'Munich', country: 'Germany', address: 'Addr', timezone: 'Europe/Berlin', is_active: true, created_at: new Date(), updated_at: new Date() };
      mockPrisma.hotel.create.mockResolvedValue(fake);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.createHotel({ name: 'Test Hotel', city: 'Munich', country: 'Germany', address: 'Addr', timezone: 'Europe/Berlin' }, 'actor_1', 'admin');

      expect(result.name).toBe('Test Hotel');
      expect(mockPrisma.hotel.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHotel', () => {
    it('returns hotel when found', async () => {
      const fake = { id: 'h1', name: 'Hotel X', city: 'Hamburg', _count: { rooms: 5 } };
      mockPrisma.hotel.findUnique.mockResolvedValue(fake);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.getHotel('h1', 'actor_1', 'manager');
      expect(result.id).toBe('h1');
    });

    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.getHotel('nonexistent', 'actor', 'admin')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });
  });

  describe('deleteHotel', () => {
    it('soft-deletes by deactivating', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1', name: 'Hotel', is_active: true });
      mockPrisma.hotel.update.mockResolvedValue({ id: 'h1', is_active: false });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.deleteHotel('h1', 'admin_1', 'admin');

      const updateCall = (mockPrisma.hotel.update as jest.Mock).mock.calls[0] as Array<{ data: { is_active: boolean } }>;
      expect(updateCall[0]?.data.is_active).toBe(false);
    });
  });
});

describe('CrmService - Rooms', () => {
  let service: CrmService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrmService();
  });

  describe('createRoom', () => {
    it('throws NotFoundError when hotel not found', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue(null);

      await expect(
        service.createRoom('bad_hotel', { number: '101', type: 'single' }, 'actor', 'manager')
      ).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ConflictError when room number already exists', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'existing_room' });

      await expect(
        service.createRoom('h1', { number: '101', type: 'single' }, 'actor', 'manager')
      ).rejects.toMatchObject({ name: 'ConflictError' });
    });

    it('creates and returns room on success', async () => {
      mockPrisma.hotel.findUnique.mockResolvedValue({ id: 'h1' });
      mockPrisma.room.findUnique.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({ id: 'r1', hotel_id: 'h1', number: '101', type: 'single', status: 'clean' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.createRoom('h1', { number: '101', type: 'single' }, 'actor', 'manager');
      expect(result.number).toBe('101');
    });
  });
});
