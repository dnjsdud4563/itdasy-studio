import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase.js';
import { filterText } from '../lib/content-filter.js';

const PostBody = z.object({
  contentType: z.enum(['text', 'image', 'tip', 'review']),
  body: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
});

const ReportBody = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'sexual', 'illegal', 'other']),
  detail: z.string().max(500).optional(),
});

export default async function moderationRoutes(app: FastifyInstance) {
  // EULA 동의 확인
  app.get('/v1/community/eula-status', { preHandler: requireAuth }, async (req) => {
    const sb = supabaseAsUser(req.accessToken!);
    const { data } = await sb.from('eula_consents').select('version, consented_at').eq('user_id', req.userId!).maybeSingle();
    return { consented: !!data, version: data?.version ?? null };
  });

  // EULA 동의
  app.post('/v1/community/eula-consent', { preHandler: requireAuth }, async (req, reply) => {
    await supabaseAdmin.from('eula_consents').upsert({ user_id: req.userId!, version: '1.0' });
    return reply.code(200).send({ ok: true });
  });

  // 게시물 작성 (콘텐츠 필터링 적용)
  app.post('/v1/community/posts', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = PostBody.safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_FAILED', message: parsed.error.message });

    // EULA 미동의 시 차단
    const { data: consent } = await supabaseAdmin.from('eula_consents').select('user_id').eq('user_id', req.userId!).maybeSingle();
    if (!consent) return reply.code(403).send({ code: 'EULA_REQUIRED', message: 'community guidelines agreement required' });

    // 텍스트 필터링
    if (parsed.data.body) {
      const check = filterText(parsed.data.body);
      if (!check.clean) return reply.code(400).send({ code: 'CONTENT_BLOCKED', message: 'inappropriate content detected' });
    }

    const { data, error } = await supabaseAdmin.from('posts').insert({
      user_id: req.userId!,
      content_type: parsed.data.contentType,
      body: parsed.data.body ?? null,
      image_url: parsed.data.imageUrl ?? null,
    }).select('id, created_at').single();

    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    return reply.code(201).send(data);
  });

  // 피드 조회 (차단 유저 자동 필터)
  app.get('/v1/community/feed', { preHandler: requireAuth }, async (req) => {
    const { limit, cursor } = req.query as { limit?: string; cursor?: string };
    const sb = supabaseAsUser(req.accessToken!);
    let q = sb.from('posts')
      .select('id, user_id, content_type, body, image_url, created_at, profiles(nickname, avatar_url)')
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(Number(limit) || 20);
    if (cursor) q = q.lt('created_at', cursor);
    const { data } = await q;
    return { items: data ?? [] };
  });

  // 신고 (게시물·댓글·사용자 단위)
  app.post('/v1/community/reports', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ReportBody.safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_FAILED', message: parsed.error.message });

    const { error } = await supabaseAdmin.from('reports').insert({
      reporter_id: req.userId!,
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      reason: parsed.data.reason,
      detail: parsed.data.detail ?? null,
    });
    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    return reply.code(201).send({ ok: true });
  });

  // 사용자 차단
  app.post('/v1/community/block/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: targetId } = req.params as { userId: string };
    if (targetId === req.userId) return reply.code(400).send({ code: 'CANNOT_BLOCK_SELF' });
    await supabaseAdmin.from('blocks').upsert({ blocker_id: req.userId!, blocked_id: targetId });
    return reply.code(200).send({ ok: true });
  });

  // 차단 해제
  app.delete('/v1/community/block/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: targetId } = req.params as { userId: string };
    await supabaseAdmin.from('blocks').delete().match({ blocker_id: req.userId!, blocked_id: targetId });
    return reply.code(204).send();
  });
}
