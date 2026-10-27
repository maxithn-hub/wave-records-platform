import { loadApiEnv } from './config/env.schema.js';
import { getPrismaClient } from './infrastructure/prisma/prisma.service.js';
import { createWaveApiApp } from './http/create-app.js';

async function bootstrapServer(): Promise<void> {
  const env = loadApiEnv();
  const prisma = getPrismaClient(env.DATABASE_URL);
  const { app } = await createWaveApiApp({ prisma, env });

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  console.log(
    `[WAVE RECORDS API] Servidor HTTP activo en http://localhost:${env.API_PORT} (${env.NODE_ENV})`,
  );
}

bootstrapServer().catch((err: unknown) => {
  console.error('[WAVE RECORDS API] Fallo crítico en el arranque:', err);
  process.exit(1);
});
