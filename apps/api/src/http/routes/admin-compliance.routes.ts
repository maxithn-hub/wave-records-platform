import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  ReviewDecisionPayloadSchema,
  type Result,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import type { AuthenticatedSessionContext } from '../../common/guards/tenant-isolation.guard.js';
import type { DocumentStoragePort } from '../../modules/compliance/ports/document-storage.port.js';
import { listComplianceQueueUseCase } from '../../modules/compliance/use-cases/list-compliance-queue.use-case.js';
import { reviewKycUseCase } from '../../modules/compliance/use-cases/review-kyc.use-case.js';
import { reviewTaxDeclarationUseCase } from '../../modules/compliance/use-cases/review-tax-declaration.use-case.js';
import { readDecryptedKycDocumentUseCase } from '../../modules/compliance/use-cases/read-decrypted-kyc-document.use-case.js';

function requireComplianceAdmin(
  request: FastifyRequest,
  jwtSecret: string,
): Result<AuthenticatedSessionContext> {
  const sessionRes = authenticateAndEnforceTenantScope({
    request,
    jwtSecret,
  });
  if (!sessionRes.ok) {
    return sessionRes;
  }

  if (sessionRes.value.role !== 'WAVE_COMPLIANCE_ADMIN') {
    return err(
      createDomainError({
        code: 'FORBIDDEN_IDOR',
        moduleName: 'AdminRoleGuard',
        message: 'Se requiere rol WAVE_COMPLIANCE_ADMIN para acceder al backoffice.',
      }),
    );
  }

  return sessionRes;
}

export async function registerAdminComplianceRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  storage: DocumentStoragePort;
}): Promise<void> {
  const { app, prisma, env, storage } = params;

  app.get('/admin/compliance/queue', async (request, reply) => {
    const adminRes = requireComplianceAdmin(request, env.JWT_ACCESS_SECRET);
    if (!adminRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(adminRes.error.code)).send(adminRes);
    }

    const queueRes = await listComplianceQueueUseCase({ prisma });
    if (!queueRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(queueRes.error.code)).send(queueRes);
    }

    return reply.status(200).send(queueRes);
  });

  app.post<{ Params: { id: string } }>(
    '/admin/compliance/kyc/:id/decision',
    async (request, reply) => {
      const adminRes = requireComplianceAdmin(request, env.JWT_ACCESS_SECRET);
      if (!adminRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(adminRes.error.code)).send(adminRes);
      }

      const parsed = ReviewDecisionPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'AdminKycDecisionController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await reviewKycUseCase({
        prisma,
        adminUserId: adminRes.value.userId,
        kycVerificationId: request.params.id,
        payload: parsed.data,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/compliance/tax/:id/decision',
    async (request, reply) => {
      const adminRes = requireComplianceAdmin(request, env.JWT_ACCESS_SECRET);
      if (!adminRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(adminRes.error.code)).send(adminRes);
      }

      const parsed = ReviewDecisionPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'AdminTaxDecisionController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await reviewTaxDeclarationUseCase({
        prisma,
        adminUserId: adminRes.value.userId,
        taxDeclarationId: request.params.id,
        payload: parsed.data,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/admin/compliance/kyc/:id/document',
    async (request, reply) => {
      const adminRes = requireComplianceAdmin(request, env.JWT_ACCESS_SECRET);
      if (!adminRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(adminRes.error.code)).send(adminRes);
      }

      const docRes = await readDecryptedKycDocumentUseCase({
        prisma,
        storage,
        adminUserId: adminRes.value.userId,
        kycVerificationId: request.params.id,
        ip: request.ip,
      });

      if (!docRes.ok) {
        return reply.status(mapDomainErrorToHttpStatus(docRes.error.code)).send(docRes);
      }

      reply.header('Content-Type', docRes.value.mimeType);
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return reply.status(200).send(docRes.value.decryptedBuffer);
    },
  );
}
