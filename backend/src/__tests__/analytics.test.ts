import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/permissions.js';

jest.mock('../lib/logger.js', () => ({
  logger: {
    info: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    warn: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    debug: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    error: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  },
}));

jest.mock('../lib/db.js', () => ({ getPrisma: () => ({}) }));
jest.mock('../config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-secret-key-minimum-32-characters-long',
    JWT_ACCESS_EXPIRY: '1h',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
  }),
  loadEnv: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
}));

function makeReq(role: string): Request {
  return {
    auth: { userId: 'u1', role, hotel_ids: [], permissions: [] },
    params: { hotel_id: 'h1' },
    query: {},
    body: {},
    requestId: 'req_test',
  } as unknown as Request;
}

describe('Analytics RBAC — requireRole middleware', () => {
  it('denies GET /stats when role is worker', () => {
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole(['admin', 'manager'])(makeReq('worker'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('denies GET /hotel-summary/:hotel_id when role is worker', () => {
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole(['admin', 'manager'])(makeReq('worker'), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('allows GET /stats when role is admin', () => {
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole(['admin', 'manager'])(makeReq('admin'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows GET /stats when role is manager', () => {
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole(['admin', 'manager'])(makeReq('manager'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
