import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import profileRoutes from './routes/profile.js';
import aiRoutes from './routes/ai.js';
import galleryRoutes from './routes/gallery.js';
import storageRoutes from './routes/storage.js';
import billingRoutes from './routes/billing.js';
import accountRoutes from './routes/account.js';
import metaRoutes from './routes/meta.js';
import imageToolsRoutes from './routes/image-tools.js';
import moderationRoutes from './routes/moderation.js';
import adminRoutes from './routes/admin.js';
import { registerAccessLog } from './middleware/access-log.js';
import { ensureBuckets } from './lib/storage.js';
import { supabaseAdmin } from './lib/supabase.js';

const app = Fastify({
  logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
  trustProxy: true,
});

// CORS: 프로덕션에서는 명시적 도메인만 허용
const origins = config.ALLOWED_ORIGINS === '*'
  ? true
  : config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
await app.register(cors, { origin: origins, credentials: true });

await app.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  allowList: ['127.0.0.1'],
});

// raw body 보존 (웹훅 서명검증 + Meta signed_request)
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try {
    (_req as unknown as { rawBody: string }).rawBody = body as string;
    done(null, JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

// Global error handler — 500 에러를 구조화된 JSON으로 반환
app.setErrorHandler((error, _req, reply) => {
  app.log.error({ err: error }, 'unhandled error');
  reply.code(error.statusCode ?? 500).send({
    code: 'INTERNAL_ERROR',
    message: config.NODE_ENV === 'production' ? 'internal error' : error.message,
    traceId: _req.id,
  });
});

// Deep healthcheck: DB ping + Storage 확인
app.get('/healthz', async () => {
  const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
  return { ok: !error, ts: new Date().toISOString(), db: error ? 'down' : 'up' };
});

await app.register(profileRoutes);
await app.register(aiRoutes);
await app.register(galleryRoutes);
await app.register(storageRoutes);
await app.register(billingRoutes);
await app.register(accountRoutes);
await app.register(metaRoutes);
await app.register(imageToolsRoutes);
await app.register(moderationRoutes);
await app.register(adminRoutes);

registerAccessLog(app);

await ensureBuckets().catch((e) => app.log.warn({ err: e }, 'bucket init'));

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`);
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen({ port: config.PORT, host: '0.0.0.0' }).then(() => {
  app.log.info(`Beauty Platform listening on :${config.PORT}`);
});
