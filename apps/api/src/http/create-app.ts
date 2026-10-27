import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { err, createDomainError } from '@wave/contracts';
import type { ApiEnvConfig } from '../config/env.schema.js';
import { EncryptedLocalDiskStorageAdapter } from '../modules/compliance/adapters/encrypted-local-disk.storage.js';
import { ManualReviewKycAdapter } from '../modules/compliance/adapters/manual-review-kyc.adapter.js';
import { getSystemHealthReport } from '../modules/health/health.service.js';
import { SlidingWindowRateLimiter } from './rate-limiter.guard.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerComplianceRoutes } from './routes/compliance.routes.js';
import { registerAdminComplianceRoutes } from './routes/admin-compliance.routes.js';
import { registerCatalogRoutes } from './routes/catalog.routes.js';
import { registerForensicsRoutes } from './routes/forensics.routes.js';
import { registerModerationRoutes } from './routes/moderation.routes.js';
import { registerRoyaltiesRoutes } from './routes/royalties.routes.js';
import { LocalQuarantineMultipartStorageAdapter } from '../modules/catalog/adapters/local-quarantine-multipart.storage.js';
import { ConfigurableAcrCloudAdapter } from '../modules/forensics/adapters/acrcloud-http.adapter.js';
import { HeadlessRevelatorAdapter } from '../modules/revelator/adapters/headless-revelator.adapter.js';

export interface CreateWaveApiAppOptions {
  readonly prisma: PrismaClient;
  readonly env: ApiEnvConfig;
  readonly maxAuthAttemptsPerMinute?: number;
  readonly quarantineStorageDir?: string;
}

export async function createWaveApiApp(
  options: CreateWaveApiAppOptions,
): Promise<{
  app: FastifyInstance;
  rateLimiter: SlidingWindowRateLimiter;
  revelatorAdapter: HeadlessRevelatorAdapter;
}> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max for KYC / W-8BEN-E PDF
      files: 1,
    },
  });

  // Global Fault-Isolation Exception Handler (never leaks raw stack traces)
  app.setErrorHandler((error, _request, reply) => {
    const traceId = randomUUID();
    reply.status(500).send(
      err(
        createDomainError({
          code: 'INTERNAL_MODULE_FAULT',
          moduleName: 'GlobalFastifyExceptionBoundary',
          traceId,
          message:
            error instanceof Error
              ? `Excepción contenida en servidor: ${error.message}`
              : 'Error interno contenido por el servidor.',
        }),
      ),
    );
  });

  const rateLimiter = new SlidingWindowRateLimiter(
    options.maxAuthAttemptsPerMinute ?? 5,
    60_000,
  );

  const storage = new EncryptedLocalDiskStorageAdapter(
    options.env.KYC_STORAGE_DIR,
    options.env.KYC_DOCUMENT_ENCRYPTION_KEY_HEX,
  );
  const kycPort = new ManualReviewKycAdapter();

  app.get('/health', async (_request, reply) => {
    const health = await getSystemHealthReport();
    return reply.status(200).send(health);
  });

  await registerAuthRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    rateLimiter,
  });

  await registerComplianceRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    storage,
    kycPort,
  });

  await registerAdminComplianceRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    storage,
  });

  const quarantineStorage = new LocalQuarantineMultipartStorageAdapter(
    options.quarantineStorageDir ?? './storage/quarantine',
  );

  await registerCatalogRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    quarantineStorage,
  });

  const acrScanner = new ConfigurableAcrCloudAdapter();

  await registerForensicsRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    acrScanner,
    documentStorage: storage,
    quarantineStorageDir: options.quarantineStorageDir ?? './storage/quarantine',
  });

  const revelatorAdapter = new HeadlessRevelatorAdapter();

  await registerModerationRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
    storage,
    revelatorGateway: revelatorAdapter,
  });

  await registerRoyaltiesRoutes({
    app,
    prisma: options.prisma,
    env: options.env,
  });

  await app.ready();
  return { app, rateLimiter, revelatorAdapter };
}
