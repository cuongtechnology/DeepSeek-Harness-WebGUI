import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient. Reuses the same instance across hot reloads in
 * development to avoid exhausting the database connection pool.
 */
const globalForPrisma = globalThis as unknown as { __dhwgPrisma?: PrismaClient };

function createPrisma(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.__dhwgPrisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__dhwgPrisma = prisma;
}

export function getPrisma(): PrismaClient {
  return prisma;
}
