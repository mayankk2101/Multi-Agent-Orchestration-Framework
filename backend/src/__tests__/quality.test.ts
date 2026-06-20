import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../middleware/permissions.js';

jest.mock('../lib/logger.js', () => ({
  logger: {
    info: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    warn: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    debug: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
    error: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  },
}));

const mockQualityVerification = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
  create: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};
const mockWorkerAssignment = {
  findUnique: jest.fn() as jest.MockedFunction<(...args: any[]) => any>,
};
const mockPrisma = {
  qualityVerification: mockQualityVerification,
  workerAssignment: mockWorkerAssignment,
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

import { QualityController } from '../modules/quality/controller.js';

function makeReq(
  body: Record<string, unknown> = {},
  auth: Partial<{ userId: string; role: string; permissions: string[] }> = {}
): Request {
  return {
    auth: { userId: 'u1', role: 'manager', permissions: [], ...auth },
    params: {},
    query: {},
    body,
    requestId: 'req_test',
  } as unknown as Request;
}

function makeRes(): { status: jest.Mock; json: jest.Mock } {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('Quality RBAC — requirePermission middleware (B4)', () => {
  function makeAuthReq(permissions: string[]): Request {
    return makeReq({}, { userId: 'u1', role: 'worker', permissions });
  }

  it('denies GET /leaderboard when quality:read permission is absent', () => {
    const req = makeAuthReq([]);
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('quality:read')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('denies POST /verifications when quality:write permission is absent', () => {
    const req = makeAuthReq(['quality:read']);
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('quality:write')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ForbiddenError' }));
  });

  it('allows GET /leaderboard when quality:read permission is present', () => {
    const req = makeAuthReq(['quality:read']);
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;
    requirePermission('quality:read')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('Quality Zod validation — createVerification (B3)', () => {
  let controller: QualityController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new QualityController();
  });

  it('rejects missing assignment_id with ValidationError', async () => {
    const req = makeReq({ score: 80 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createVerification(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects score > 100 with ValidationError', async () => {
    const req = makeReq({ assignment_id: 'a1', score: 101 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createVerification(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects non-integer score with ValidationError', async () => {
    const req = makeReq({ assignment_id: 'a1', score: 85.5 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createVerification(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('Quality Zod validation — createRating (P2-03)', () => {
  let controller: QualityController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new QualityController();
  });

  it('rejects missing worker_id with ValidationError', async () => {
    const req = makeReq({ assignment_id: 'a1', score: 4 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createRating(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects score out of range (>5) with ValidationError', async () => {
    const req = makeReq({ assignment_id: 'a1', worker_id: 'w1', score: 6 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createRating(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects non-integer score with ValidationError', async () => {
    const req = makeReq({ assignment_id: 'a1', worker_id: 'w1', score: 3.5 });
    const res = makeRes();
    const next = jest.fn() as jest.MockedFunction<(...args: any[]) => any> as unknown as NextFunction;

    await controller.createRating(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ValidationError' }));
    expect(res.status).not.toHaveBeenCalled();
  });
});
