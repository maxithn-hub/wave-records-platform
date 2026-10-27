import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  CreateReleaseDraftPayloadSchema,
  UpsertTrackMetadataPayloadSchema,
  InitMultipartUploadPayloadSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import type { QuarantineMultipartStoragePort } from '../../modules/catalog/ports/quarantine-multipart.port.js';
import { createReleaseDraftUseCase } from '../../modules/catalog/use-cases/create-release-draft.use-case.js';
import { upsertTrackMetadataUseCase } from '../../modules/catalog/use-cases/upsert-track-metadata.use-case.js';
import { initMultipartUploadUseCase } from '../../modules/catalog/use-cases/init-multipart-upload.use-case.js';
import { uploadMultipartChunkUseCase } from '../../modules/catalog/use-cases/upload-multipart-chunk.use-case.js';
import { completeMultipartUploadUseCase } from '../../modules/catalog/use-cases/complete-multipart-upload.use-case.js';
import { submitReleaseToForensicsUseCase } from '../../modules/catalog/use-cases/submit-release-to-forensics.use-case.js';
import { getReleaseDetailUseCase } from '../../modules/catalog/use-cases/get-release-detail.use-case.js';
import { listTenantReleasesUseCase } from '../../modules/catalog/use-cases/list-tenant-releases.use-case.js';

export async function registerCatalogRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  quarantineStorage: QuarantineMultipartStoragePort;
}): Promise<void> {
  const { app, prisma, env, quarantineStorage } = params;

  // Allow raw binary bodies for chunked PUT uploads
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: 12 * 1024 * 1024 },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.get('/catalog/releases', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const result = await listTenantReleasesUseCase({
      prisma,
      sessionTenantId: sessionRes.value.sessionTenantId,
    });
    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.post('/catalog/releases', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const parsed = CreateReleaseDraftPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'CreateReleaseController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await createReleaseDraftUseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      payload: parsed.data,
      ip: request.ip,
    });
    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });

  app.get<{ Params: { id: string } }>('/catalog/releases/:id', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const result = await getReleaseDetailUseCase({
      prisma,
      sessionTenantId: sessionRes.value.sessionTenantId,
      releaseId: request.params.id,
    });
    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.post<{ Params: { id: string } }>(
    '/catalog/releases/:id/tracks',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
      }

      const parsed = UpsertTrackMetadataPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'UpsertTrackController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await upsertTrackMetadataUseCase({
        prisma,
        sessionTenantId: sessionRes.value.sessionTenantId,
        releaseId: request.params.id,
        payload: parsed.data,
      });
      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post('/catalog/uploads/init', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const parsed = InitMultipartUploadPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'InitMultipartUploadController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await initMultipartUploadUseCase({
      prisma,
      sessionTenantId: sessionRes.value.sessionTenantId,
      payload: parsed.data,
    });
    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });

  app.put<{ Params: { sessionId: string; partNumber: string } }>(
    '/catalog/uploads/:sessionId/part/:partNumber',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
      }

      const partNum = Number(request.params.partNumber);
      const rawBody = request.body;
      const chunkBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.alloc(0);

      const result = await uploadMultipartChunkUseCase({
        prisma,
        storage: quarantineStorage,
        sessionTenantId: sessionRes.value.sessionTenantId,
        uploadSessionId: request.params.sessionId,
        partNumber: partNum,
        chunkBuffer,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    '/catalog/uploads/:sessionId/complete',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
      }

      const result = await completeMultipartUploadUseCase({
        prisma,
        storage: quarantineStorage,
        actorUserId: sessionRes.value.userId,
        sessionTenantId: sessionRes.value.sessionTenantId,
        uploadSessionId: request.params.sessionId,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/catalog/releases/:id/submit',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
      }

      const result = await submitReleaseToForensicsUseCase({
        prisma,
        actorUserId: sessionRes.value.userId,
        sessionTenantId: sessionRes.value.sessionTenantId,
        releaseId: request.params.id,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );
}
