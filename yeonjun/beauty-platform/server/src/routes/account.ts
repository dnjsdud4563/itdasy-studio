import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';

export default async function accountRoutes(app: FastifyInstance) {
  app.post('/v1/account/export', { preHandler: requireAuth }, async (req, reply) => {
    const res = await fetch(`${config.SUPABASE_URL}/functions/v1/export-user-data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: req.userId }),
    });
    if (!res.ok) {
      return reply.code(500).send({ code: 'EXPORT_FAILED', message: await res.text() });
    }
    const { url } = (await res.json()) as { url: string };
    return reply.code(202).send({ url });
  });

  app.delete('/v1/account', { preHandler: requireAuth }, async (req, reply) => {
    await supabaseAdmin.from('account_deletion_requests').upsert({ user_id: req.userId! });
    return reply.code(202).send({ purgeAfter: '30 days' });
  });

  app.post('/v1/push/register', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { platform: 'ios' | 'android'; token: string };
    if (!body?.token || !['ios', 'android'].includes(body?.platform)) {
      return reply.code(422).send({ code: 'VALIDATION_FAILED' });
    }
    await supabaseAdmin.from('push_tokens').upsert({
      user_id: req.userId!,
      platform: body.platform,
      token: body.token,
    });
    return reply.code(204).send();
  });
}
