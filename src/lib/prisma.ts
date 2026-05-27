import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined;
};

// Use a getter to avoid initializing Prisma during the build/pre-render phase 
// if it's not actually needed or if the environment isn't ready.
export const getPrisma = () => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
};

export const prisma = getPrisma();
