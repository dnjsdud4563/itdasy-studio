import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';
import { config } from '../config.js';

// 관리자 인증: 별도 ADMIN_SECRET 헤더로 보호 (심사 시 24h 대응 증빙)
async function requireAdmin(req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== config.ADMIN_SECRET) {
    return reply.code(403).send({ code: 'ADMIN_REQUIRED' });
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  // 대기 중인 신고 목록
  app.get('/v1/admin/reports', { preHandler: requireAdmin }, async (req) => {
    const { status } = req.query as { status?: string };
    const q = supabaseAdmin.from('reports')
      .select('*, profiles!reporter_id(nickname)')
      .order('created_at', { ascending: true })
      .limit(50);
    if (status) q.eq('status', status);
    const { data } = await q;
    return { items: data ?? [] };
  });

  // 신고 처리 (reviewed/resolved/dismissed)
  app.patch('/v1/admin/reports/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, hideContent } = req.body as { status: string; hideContent?: boolean };

    await supabaseAdmin.from('reports').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);

    // 콘텐츠 숨김 처리
    if (hideContent) {
      const { data: report } = await supabaseAdmin.from('reports').select('target_type, target_id').eq('id', id).single();
      if (report) {
        const table = report.target_type === 'post' ? 'posts' : report.target_type === 'comment' ? 'comments' : null;
        if (table) {
          await supabaseAdmin.from(table).update({ is_hidden: true }).eq('id', report.target_id);
        }
      }
    }
    return reply.code(200).send({ ok: true });
  });

  // 사용자 퇴출 (ban)
  app.post('/v1/admin/ban/:userId', { preHandler: requireAdmin }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    // 모든 게시물·댓글 숨김
    await supabaseAdmin.from('posts').update({ is_hidden: true }).eq('user_id', userId);
    await supabaseAdmin.from('comments').update({ is_hidden: true }).eq('user_id', userId);
    // 프로필에 banned 표시
    await supabaseAdmin.from('profiles').update({ plan: 'banned' as never }).eq('id', userId);
    return reply.code(200).send({ ok: true, banned: userId });
  });

  // 통계 (심사 대응용: 신고 처리 현황)
  app.get('/v1/admin/stats', { preHandler: requireAdmin }, async () => {
    const { count: pending } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: resolved } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved');
    const { count: totalUsers } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
    return { pendingReports: pending ?? 0, resolvedReports: resolved ?? 0, totalUsers: totalUsers ?? 0 };
  });
}
