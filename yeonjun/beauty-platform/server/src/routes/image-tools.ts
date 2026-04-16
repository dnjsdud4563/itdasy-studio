import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { removeBackground } from '../lib/remove-bg.js';
import { putObject } from '../lib/r2.js';
import { config } from '../config.js';

export default async function imageToolsRoutes(app: FastifyInstance) {
  app.post('/v1/image/remove-bg', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { imageUrl?: string };
    if (!body?.imageUrl) {
      return reply.code(422).send({ code: 'VALIDATION_FAILED', message: 'imageUrl required' });
    }

    // 이미지 다운로드
    const imgRes = await fetch(body.imageUrl);
    if (!imgRes.ok) return reply.code(400).send({ code: 'FETCH_FAILED', message: 'cannot fetch image' });
    const inputBuffer = Buffer.from(await imgRes.arrayBuffer());

    // 배경 제거 (RMBG-2.0)
    let resultBuffer: Buffer;
    try {
      resultBuffer = await removeBackground(inputBuffer);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith('MODEL_LOADING')) {
        return reply.code(503).send({ code: 'MODEL_LOADING', message: 'AI model is warming up, retry in 10 seconds' });
      }
      app.log.error({ err: e }, 'remove-bg failed');
      return reply.code(502).send({ code: 'UPSTREAM_FAILED', message: 'background removal failed' });
    }

    // R2에 저장
    const key = `nobg/${req.userId}/${randomUUID()}.png`;
    const publicUrl = await putObject('beauty-ai-generated', key, resultBuffer, 'image/png');

    return {
      imageUrl: publicUrl,
      objectKey: key,
      sizeBytes: resultBuffer.length,
      aiDisclosure: {
        isAiGenerated: true,
        model: 'briaai/RMBG-2.0',
        notice: '이 이미지는 AI 배경 제거 기술로 처리되었습니다. Processed with AI background removal.',
      },
    };
  });
}
