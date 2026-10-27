import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  RunForensicPipelinePayloadSchema,
  err,
  createDomainError,
} from '@wave/contracts';
import type { ApiEnvConfig } from '../../config/env.schema.js';
import { mapDomainErrorToHttpStatus } from '../../common/http/result-to-http.mapper.js';
import { authenticateAndEnforceTenantScope } from '../request-session.extractor.js';
import type { AcrCloudScannerPort } from '../../modules/forensics/ports/acrcloud-scanner.port.js';
import type { DocumentStoragePort } from '../../modules/compliance/ports/document-storage.port.js';
import { runReleaseForensicScanUseCase } from '../../modules/forensics/use-cases/run-release-forensic-scan.use-case.js';
import { submitBeatLicensePdfUseCase } from '../../modules/forensics/use-cases/submit-beat-license-pdf.use-case.js';
import { getLatestForensicReportUseCase } from '../../modules/forensics/use-cases/get-latest-forensic-report.use-case.js';

export async function registerForensicsRoutes(params: {
  app: FastifyInstance;
  prisma: PrismaClient;
  env: ApiEnvConfig;
  acrScanner: AcrCloudScannerPort;
  documentStorage: DocumentStoragePort;
  quarantineStorageDir: string;
}): Promise<void> {
  const { app, prisma, env, acrScanner, documentStorage, quarantineStorageDir } =
    params;

  app.post<{ Params: { id: string } }>(
    '/forensics/releases/:id/scan',
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

      const parsed = RunForensicPipelinePayloadSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'RunForensicScanController',
              message: parsed.error.issues.map((i) => i.message).join('; '),
            }),
          ),
        );
      }

      const result = await runReleaseForensicScanUseCase({
        prisma,
        acrScanner,
        quarantineStorageDir,
        actorUserId: sessionRes.value.userId,
        sessionTenantId: sessionRes.value.sessionTenantId,
        releaseId: request.params.id,
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
    '/forensics/releases/:id/report',
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

      const result = await getLatestForensicReportUseCase({
        prisma,
        sessionTenantId: sessionRes.value.sessionTenantId,
        releaseId: request.params.id,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/forensics/releases/:id/license-pdf',
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

      let pdfBuffer: Buffer | null = null;
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          pdfBuffer = await part.toBuffer();
        }
      }

      if (!pdfBuffer) {
        return reply.status(422).send(
          err(
            createDomainError({
              code: 'VALIDATION_ERROR',
              moduleName: 'SubmitBeatLicensePdfController',
              message: 'Debes adjuntar el archivo PDF de la licencia de uso.',
            }),
          ),
        );
      }

      const result = await submitBeatLicensePdfUseCase({
        prisma,
        storage: documentStorage,
        actorUserId: sessionRes.value.userId,
        sessionTenantId: sessionRes.value.sessionTenantId,
        releaseId: request.params.id,
        rawPdfBuffer: pdfBuffer,
        ip: request.ip,
      });

      if (!result.ok) {
        return reply.status(mapDomainErrorToHttpStatus(result.error.code)).send(result);
      }

      return reply.status(200).send(result);
    },
  );
}
