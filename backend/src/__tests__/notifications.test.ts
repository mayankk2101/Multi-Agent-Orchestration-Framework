import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockNotification = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  findMany: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  update: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  create: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};

const mockPrisma = {
  notification: mockNotification,
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

import { NotificationService } from '../modules/notifications/service.js';

const makeNotification = (overrides: Record<string, unknown> = {}) => ({
  id: 'notif1',
  user_id: 'u1',
  type: 'QUALITY_VERIFICATION_SUBMITTED',
  title: 'Test Notification',
  message: 'Test message',
  data: {},
  is_read: false,
  read_at: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe('markAsRead', () => {
    it('throws NotFoundError when notification does not exist', async () => {
      mockNotification.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('notif1', 'u1')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('throws ForbiddenError when caller is not the notification owner (B2)', async () => {
      mockNotification.findUnique.mockResolvedValue(makeNotification({ user_id: 'u1' }));
      await expect(service.markAsRead('notif1', 'u2')).rejects.toMatchObject({
        name: 'ForbiddenError',
      });
    });

    it('marks notification as read and returns updated record when caller is owner (B2)', async () => {
      mockNotification.findUnique.mockResolvedValue(makeNotification({ user_id: 'u1' }));
      const updated = makeNotification({ user_id: 'u1', is_read: true, read_at: new Date() });
      mockNotification.update.mockResolvedValue(updated);

      const result = await service.markAsRead('notif1', 'u1');

      expect(result.is_read).toBe(true);
      const updateArgs = mockNotification.update.mock.calls[0][0] as any;
      expect(updateArgs.where).toEqual({ id: 'notif1' });
      expect(updateArgs.data.is_read).toBe(true);
      expect(updateArgs.data.read_at).toBeInstanceOf(Date);
    });
  });
});
