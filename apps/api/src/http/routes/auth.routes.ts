import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  RegisterTenantPayloadSchema,
  LoginPayloadSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { registerTenantUseCase } from '../../modules/auth/use-cases/register-tenant.use-case.js';
import { authenticateUserUseCase } from '../../modules/auth/use-cases/authenticate-user.use-case.js';
import { rotateRefreshTokenUseCase } from '../../modules/auth/use-cases/rotate-refresh-token.use-case.js';
import { getCurrentUserUseCase } from '../../modules/auth/use-cases/get-current-user.use-case.js';
import { hashRefreshToken } from '../../modules/auth/services/refresh-token.service.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import { SlidingWindowRateLimiter } from '../rate-limiter.guard.js';

export const REFRESH_COOKIE_NAME = 'wave_refresh_token';

function setRefreshTokenCookie(
  reply: FastifyReply,
  rawToken: string,
  expiresAt: Date,
  isProd: boolean,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export async function registerAuthRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  rateLimiter: SlidingWindowRateLimiter;
}): Promise<void> {
  const { app, prisma, env, rateLimiter } = params;
  const isProd = env.NODE_ENV === 'production';

  app.post('/auth/register', async (request, reply) => {
    const parsed = RegisterTenantPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'AuthRegisterController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const rateKey = `reg:${request.ip}:${parsed.data.email}`;
    const limit = rateLimiter.consume(rateKey);
    if (!limit.allowed) {
      reply.header('Retry-After', String(limit.retryAfterSeconds));
      return reply.status(429).send(
        err(
          createDomainError({
            code: 'UNAUTHORIZED',
            moduleName: 'AuthRateLimiter',
            message: 'Demasiados intentos. Intenta nuevamente en un minuto.',
          }),
        ),
      );
    }

    const result = await registerTenantUseCase({
      prisma,
      payload: parsed.data,
      jwtSecret: env.JWT_ACCESS_SECRET,
      jwtTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshPepper: env.REFRESH_TOKEN_PEPPER,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    setRefreshTokenCookie(
      reply,
      result.value.rawRefreshToken,
      result.value.refreshExpiresAt,
      isProd,
    );

    return reply.status(201).send({
      ok: true,
      value: {
        accessToken: result.value.accessToken,
        expiresInSeconds: result.value.expiresInSeconds,
      },
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = LoginPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'AuthLoginController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const rateKey = `login:${request.ip}:${parsed.data.email}`;
    const limit = rateLimiter.consume(rateKey);
    if (!limit.allowed) {
      reply.header('Retry-After', String(limit.retryAfterSeconds));
      return reply.status(429).send(
        err(
          createDomainError({
            code: 'UNAUTHORIZED',
            moduleName: 'AuthRateLimiter',
            message: 'Demasiados intentos de inicio de sesión. Espera 60 segundos.',
          }),
        ),
      );
    }

    const result = await authenticateUserUseCase({
      prisma,
      payload: parsed.data,
      jwtSecret: env.JWT_ACCESS_SECRET,
      jwtTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshPepper: env.REFRESH_TOKEN_PEPPER,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    setRefreshTokenCookie(
      reply,
      result.value.rawRefreshToken,
      result.value.refreshExpiresAt,
      isProd,
    );

    return reply.status(200).send({
      ok: true,
      value: {
        accessToken: result.value.accessToken,
        expiresInSeconds: result.value.expiresInSeconds,
      },
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const rawCookieToken = request.cookies[REFRESH_COOKIE_NAME];
    if (!rawCookieToken) {
      return reply.status(401).send(
        err(
          createDomainError({
            code: 'UNAUTHORIZED',
            moduleName: 'AuthRefreshController',
            message: 'Cookie de refresco no presente.',
          }),
        ),
      );
    }

    const result = await rotateRefreshTokenUseCase({
      prisma,
      rawRefreshToken: rawCookieToken,
      jwtSecret: env.JWT_ACCESS_SECRET,
      jwtTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshPepper: env.REFRESH_TOKEN_PEPPER,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    setRefreshTokenCookie(
      reply,
      result.value.rawRefreshToken,
      result.value.refreshExpiresAt,
      isProd,
    );

    return reply.status(200).send({
      ok: true,
      value: {
        accessToken: result.value.accessToken,
        expiresInSeconds: result.value.expiresInSeconds,
      },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const rawCookieToken = request.cookies[REFRESH_COOKIE_NAME];
    if (rawCookieToken) {
      const tokenHash = hashRefreshToken(rawCookieToken, env.REFRESH_TOKEN_PEPPER);
      await prisma.refreshToken
        .updateMany({
          where: { tokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => null);
    }

    reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return reply.status(200).send({ ok: true, value: { loggedOut: true } });
  });

  app.get('/auth/me', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const meRes = await getCurrentUserUseCase({
      prisma,
      userId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
    });
    if (!meRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(meRes.error.code)).send(meRes);
    }

    return reply.status(200).send(meRes);
  });
}
