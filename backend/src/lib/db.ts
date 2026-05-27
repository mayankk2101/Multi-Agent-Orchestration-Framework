import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();

    prisma.$connect()
      .then(() => {
        logger.info('Connected to database');
      })
      .catch((error) => {
        logger.error('Failed to connect to database', { error: error.message });
        process.exit(1);
      });
  }

  return prisma;
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  }
}
