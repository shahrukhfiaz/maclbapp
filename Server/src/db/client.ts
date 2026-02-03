import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    throw error;
  }
}
