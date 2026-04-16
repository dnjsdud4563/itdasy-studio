import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { createSignedUploadUrl, UPLOADS_BUCKET } from '../lib/storage.js';

const Body = z.object({
  purpose: z.enum(['selfie', 'reference', 'avatar']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export default async function storageRoutes(app: FastifyInstance) {
  app.post('/v1/storage/presign', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_FAILED', message: parsed.error.message });

    const ext = parsed.data.contentType.split('/')[1];
    const objectPath = `${parsed.data.purpose}/${req.userId}/${randomUUID()}.${ext}`;
    const { signedUrl, path } = await createSignedUploadUrl(UPLOADS_BUCKET, objectPath);

    return {
      uploadUrl: signedUrl,
      objectKey: path,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  });
}
