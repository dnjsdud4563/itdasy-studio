import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAsUser, supabaseAdmin } from '../lib/supabase.js';
import { encryptPII } from '../lib/crypto.js';

const UpdateSchema = z.object({
  nickname: z.string().min(2).max(20).optional(),
  phone: z.string().optional(),
  realName: z.string().optional(),
});

export default async function profileRoutes(app: FastifyInstance) {
  app.get('/v1/profile', { preHandler: requireAuth }, async (req, reply) => {
    const sb = supabaseAsUser(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .select('id, nickname, avatar_url, plan, credits_remaining, created_at')
      .eq('id', req.userId!)
      .single();
    if (error) return reply.code(404).send({ code: 'NOT_FOUND', message: error.message });
    return {
      userId: data.id,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      plan: data.plan,
      creditsRemaining: data.credits_remaining,
      createdAt: data.created_at,
    };
  });

  app.patch('/v1/profile', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_FAILED', message: parsed.error.message });
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.nickname) patch.nickname = parsed.data.nickname;
    if (parsed.data.phone) patch.phone_ciphertext = encryptPII(parsed.data.phone);
    if (parsed.data.realName) patch.real_name_ciphertext = encryptPII(parsed.data.realName);

    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', req.userId!);
    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    return reply.code(200).send({ ok: true });
  });
}
