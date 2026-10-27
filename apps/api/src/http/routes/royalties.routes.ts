import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  ConfigureTrackSplitsInputSchema,
  IngestRoyaltyStatementInputSchema,
  RequestPayoutInputSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import { configureTrackSplitsUseCase } from '../../modules/royalties/use-cases/configure-track-splits.use-case.js';
import { ingestRoyaltyStatementUseCase } from '../../modules/royalties/use-cases/ingest-royalty-statement.use-case.js';
import { claimEscrowSplitsUseCase } from '../../modules/royalties/use-cases/claim-escrow-splits.use-case.js';
import { requestRoyaltyPayoutUseCase } from '../../modules/royalties/use-cases/request-royalty-payout.use-case.js';
import { getRoyaltyDashboardUseCase } from '../../modules/royalties/use-cases/get-royalty-dashboard.use-case.js';

export async function registerRoyaltiesRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
}): Promise<void> {
  const { app, prisma, env } = params;

  app.post<{ Params: { trackId: string } }>(
    '/royalties/tracks/:trackId/splits',
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

      const parsed = ConfigureTrackSplitsInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'ConfigureTrackSplitsController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await configureTrackSplitsUseCase({
        prisma,
        actorUserId: sessionRes.value.userId,
        sessionTenantId: sessionRes.value.sessionTenantId,
        trackId: request.params.trackId,
        input: parsed.data,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post('/royalties/statements/ingest', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply
        .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
        .send(sessionRes);
    }

    const headerIdemKey = request.headers['idempotency-key'];
    const rawBody =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : {};
    const mergedBody = {
      ...rawBody,
      ...(typeof headerIdemKey === 'string' && !rawBody.idempotencyKey
        ? { idempotencyKey: headerIdemKey }
        : {}),
    };

    const parsed = IngestRoyaltyStatementInputSchema.safeParse(mergedBody);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'IngestRoyaltyStatementController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await ingestRoyaltyStatementUseCase({
      prisma,
      input: parsed.data,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.post('/royalties/splits/claim-escrow', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply
        .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
        .send(sessionRes);
    }

    const result = await claimEscrowSplitsUseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      ip: request.ip,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.get('/royalties/dashboard', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply
        .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
        .send(sessionRes);
    }

    const result = await getRoyaltyDashboardUseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });

  app.post('/royalties/payouts', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply
        .status(mapDomainErrorToHttpStatus(sessionRes.error.code))
        .send(sessionRes);
    }

    const headerIdemKey = request.headers['idempotency-key'];
    const rawBody =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : {};
    const mergedBody = {
      ...rawBody,
      ...(typeof headerIdemKey === 'string' && !rawBody.idempotencyKey
        ? { idempotencyKey: headerIdemKey }
        : {}),
    };

    const parsed = RequestPayoutInputSchema.safeParse(mergedBody);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'RequestPayoutController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await requestRoyaltyPayoutUseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      input: parsed.data,
      ip: request.ip,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(200).send(result);
  });
}
