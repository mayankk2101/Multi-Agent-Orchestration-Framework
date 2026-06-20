import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

/**
 * Establish and verify database connectivity before the server begins
 * accepting traffic. Unlike getPrisma(), this awaits $connect() so the
 * caller can fail fast at startup when the database is unavailable instead
 * of the server listening on a half-ready connection.
 */
export async function connectDb(): Promise<void> {
  const client = getPrisma();
  await client.$connect();
  logger.info('Connected to database');
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  }
}
