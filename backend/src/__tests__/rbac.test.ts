import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission, checkHotelAccess } from '../middleware/permissions.js';

jest.mock('../lib/logger.js', () => ({
  logger: { info: jest.fn() as jest.MockedFunction<(...args: any[]) => any>, warn: jest.fn() as jest.MockedFunction<(...args: any[]) => any>, debug: jest.fn() as jest.MockedFunction<(...args: any[]) => any>, error: jest.fn() as jest.MockedFunction<(...args: any[]) => any> },
}));

function makeReq(auth?: Partial<{ userId: string; role: string; hotel_ids: string[]; permissions: string[]; email: string }>): Request {
  return {
    auth,
    params: {},
    query: {},
    body: {},
    requestId: 'req_test',
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

describe('requireRole middleware', () => {
  it('calls next() when role matches', () => {
    const req = makeReq({ userId: 'u1', role: 'admin', hotel_ids: [], permissions: [] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole('admin')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) when role does not match', () => {
    const req = makeReq({ userId: 'u1', role: 'worker', hotel_ids: [], permissions: [] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole('admin')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('calls next(UnauthorizedError) when no auth', () => {
    const req = makeReq(undefined);
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole('admin')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'UnauthorizedError' }));
  });

  it('accepts array of allowed roles', () => {
    const req = makeReq({ userId: 'u1', role: 'manager', hotel_ids: [], permissions: [] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requireRole(['admin', 'manager'])(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requirePermission middleware', () => {
  it('allows when user has exact permission', () => {
    const req = makeReq({ userId: 'u1', role: 'manager', hotel_ids: [], permissions: ['hotels:read'] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('hotels:read')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows when user has wildcard permission', () => {
    const req = makeReq({ userId: 'u1', role: 'manager', hotel_ids: [], permissions: ['hotels:*'] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('hotels:read')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows when user has admin:*', () => {
    const req = makeReq({ userId: 'u1', role: 'admin', hotel_ids: [], permissions: ['admin:*'] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('hotels:write')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies when permission missing', () => {
    const req = makeReq({ userId: 'u1', role: 'worker', hotel_ids: [], permissions: ['hotels:read'] });
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('hotels:write')(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });
});

describe('checkHotelAccess middleware', () => {
  it('allows admins to access any hotel', () => {
    const req = makeReq({ userId: 'u1', role: 'admin', hotel_ids: [], permissions: [] });
    (req as unknown as Record<string, unknown>)['params'] = { hotel_id: 'h1' };
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    checkHotelAccess()(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows managers who have the hotel in their list', () => {
    const req = makeReq({ userId: 'u1', role: 'manager', hotel_ids: ['h1', 'h2'], permissions: [] });
    (req as unknown as Record<string, unknown>)['params'] = { hotel_id: 'h1' };
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    checkHotelAccess()(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies managers who do not have the hotel', () => {
    const req = makeReq({ userId: 'u1', role: 'manager', hotel_ids: ['h2'], permissions: [] });
    (req as unknown as Record<string, unknown>)['params'] = { hotel_id: 'h1' };
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    checkHotelAccess()(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });
});
