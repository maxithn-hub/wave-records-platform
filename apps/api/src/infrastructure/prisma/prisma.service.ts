import { PrismaClient } from '@prisma/client';

let sharedPrismaClient: PrismaClient | null = null;

export function getPrismaClient(datasourceUrl?: string): PrismaClient {
  if (datasourceUrl) {
    return new PrismaClient({
      datasources: { db: { url: datasourceUrl } },
    });
  }
  if (!sharedPrismaClient) {
    sharedPrismaClient = new PrismaClient();
  }
  return sharedPrismaClient;
}
