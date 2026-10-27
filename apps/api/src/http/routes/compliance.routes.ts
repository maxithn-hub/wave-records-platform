import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  KycDocumentTypeSchema,
  SubmitW9PayloadSchema,
  SubmitW8BenPayloadSchema,
  SubmitW8BenEMetadataSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import type { DocumentStoragePort } from '../../modules/compliance/ports/document-storage.port.js';
import type { IdentityVerificationPort } from '../../modules/compliance/ports/identity-verification.port.js';
import { submitKycDocumentUseCase } from '../../modules/compliance/use-cases/submit-kyc-document.use-case.js';
import { submitW9UseCase } from '../../modules/compliance/use-cases/submit-w9.use-case.js';
import { submitW8BenUseCase } from '../../modules/compliance/use-cases/submit-w8ben.use-case.js';
import { submitW8BenEPdfUseCase } from '../../modules/compliance/use-cases/submit-w8bene-pdf.use-case.js';
import { getComplianceStatusUseCase } from '../../modules/compliance/use-cases/get-compliance-status.use-case.js';

export async function registerComplianceRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  storage: DocumentStoragePort;
  kycPort: IdentityVerificationPort;
}): Promise<void> {
  const { app, prisma, env, storage, kycPort } = params;

  app.get('/compliance/status', async (request, reply) => {
    const queryBag = (request.query as Record<string, unknown> | undefined) ?? {};
    const requestedTenantId =
      typeof queryBag.tenantId === 'string' ? queryBag.tenantId : undefined;

    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
      ...(requestedTenantId !== undefined
        ? { targetResourceTenantId: requestedTenantId }
        : {}),
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const statusRes = await getComplianceStatusUseCase({
      prisma,
      sessionTenantId: requestedTenantId ?? sessionRes.value.sessionTenantId,
    });
    if (!statusRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(statusRes.error.code)).send(statusRes);
    }

    return reply.status(200).send(statusRes);
  });

  app.post('/compliance/kyc/documents', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    let documentTypeRaw = '';
    let fileBuffer: Buffer | null = null;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
      } else if (part.fieldname === 'documentType' && typeof part.value === 'string') {
        documentTypeRaw = part.value;
      }
    }

    const docTypeParsed = KycDocumentTypeSchema.safeParse(documentTypeRaw);
    if (!docTypeParsed.success || !fileBuffer) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'SubmitKycController',
            message: 'Debes adjuntar un archivo válido e indicar el tipo de documento KYC.',
          }),
        ),
      );
    }

    const result = await submitKycDocumentUseCase({
      prisma,
      storage,
      kycPort,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      documentType: docTypeParsed.data,
      rawFileBuffer: fileBuffer,
      ip: request.ip,
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });

  app.post('/compliance/tax/w9', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const parsed = SubmitW9PayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'SubmitW9Controller',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await submitW9UseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      payload: parsed.data,
      taxMasterKeyHex: env.TAX_ENCRYPTION_MASTER_KEY_HEX,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });

  app.post('/compliance/tax/w8ben', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const parsed = SubmitW8BenPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'SubmitW8BenController',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await submitW8BenUseCase({
      prisma,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      payload: parsed.data,
      taxMasterKeyHex: env.TAX_ENCRYPTION_MASTER_KEY_HEX,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });

  app.post('/compliance/tax/w8bene', async (request, reply) => {
    const sessionRes = authenticateAndEnforceTenantScope({
      request,
      jwtSecret: env.JWT_ACCESS_SECRET,
    });
    if (!sessionRes.ok) {
      return reply.status(mapDomainErrorToHttpStatus(sessionRes.error.code)).send(sessionRes);
    }

    const fields: Record<string, string> = {};
    let pdfBuffer: Buffer | null = null;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        pdfBuffer = await part.toBuffer();
      } else if (typeof part.value === 'string') {
        fields[part.fieldname] = part.value;
      }
    }

    const metaParsed = SubmitW8BenEMetadataSchema.safeParse({
      formType: 'W8BENE',
      entityLegalName: fields.entityLegalName,
      countryOfIncorporation: fields.countryOfIncorporation,
      electronicSignatureName: fields.electronicSignatureName,
    });

    if (!metaParsed.success || !pdfBuffer) {
      return reply.status(422).send(
        err(
          createDomainError({
            code: 'VALIDATION_ERROR',
            moduleName: 'SubmitW8BenEController',
            message: metaParsed.success
              ? 'Debes adjuntar el archivo PDF firmado del W-8BEN-E.'
              : metaParsed.error.issues.map((i) => i.message).join('; '),
          }),
        ),
      );
    }

    const result = await submitW8BenEPdfUseCase({
      prisma,
      storage,
      actorUserId: sessionRes.value.userId,
      sessionTenantId: sessionRes.value.sessionTenantId,
      metadata: metaParsed.data,
      rawPdfBuffer: pdfBuffer,
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });

    if (!result.ok) {
      return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
    }

    return reply.status(201).send(result);
  });
}
