import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  AdminReleaseDecisionInputSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import type { DocumentStoragePort } from '../../modules/compliance/ports/document-storage.port.js';
import type { RevelatorGatewayPort } from '../../modules/revelator/ports/revelator-gateway.port.js';
import { listModerationQueueUseCase } from '../../modules/moderation/use-cases/list-moderation-queue.use-case.js';
import { inspectBeatLicensePdfUseCase } from '../../modules/moderation/use-cases/inspect-beat-license-pdf.use-case.js';
import { moderateAndDispatchReleaseUseCase } from '../../modules/moderation/use-cases/moderate-and-dispatch-release.use-case.js';

export async function registerModerationRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  storage: DocumentStoragePort;
  revelatorGateway: RevelatorGatewayPort;
}): Promise<void> {
  const { app, prisma, env, storage, revelatorGateway } = params;

  app.get('/admin/moderation/queue', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply
        .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
        .send(sessionRes);
    }

    const result = await listModerationQueueUseCase({
      prisma,
      actorRole: sessionRes.value.role,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.get<{ Params: { id: string } }>(
    '/admin/moderation/releases/:id/beat-license',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply
          .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
          .send(sessionRes);
      }

      const result = await inspectBeatLicensePdfUseCase({
        prisma,
        storage,
        actorUserId: sessionRes.value.userId,
        actorRole: sessionRes.value.role,
        releaseId: request.params.id,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/moderation/releases/:id/decision',
    async (request, reply) => {
      const sessionRes = authenticateAndEnforceTenantScope({
        request,
        jwtSecret: env.JWT_ACCESS_SECRET,
      });
      if (!sessionRes.ok) {
        return reply
          .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
          .send(sessionRes);
      }

      const parsed = AdminReleaseDecisionInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'ModerateReleaseController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await moderateAndDispatchReleaseUseCase({
        prisma,
        revelatorGateway,
        actorUserId: sessionRes.value.userId,
        actorRole: sessionRes.value.role,
        releaseId: request.params.id,
        input: parsed.data,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );
}
