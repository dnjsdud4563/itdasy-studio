import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

// 통신비밀보호법: 접속 로그 90일 보관 의무
// IP는 SHA-256 + 솔트로 해시하여 저장 (원본 IP 미보관)

const IP_SALT = process.env.PII_ENCRYPTION_KEY?.slice(0, 16) ?? 'default-salt';

function hashIP(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex').slice(0, 32);
}

export function registerAccessLog(app: FastifyInstance) {
  app.addHook('onResponse', async (req, reply) => {
    // healthz, 정적 리소스는 제외
    if (req.url === '/healthz') return;

    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
    await supabaseAdmin.from('access_logs').insert({
      user_id: req.userId ?? null,
      ip_hash: hashIP(ip),
      user_agent: (req.headers['user-agent'] ?? '').slice(0, 256),
      path: req.url.split('?')[0],
      method: req.method,
      status: reply.statusCode,
    }).then(({ error }) => {
      if (error) app.log.warn({ err: error }, 'access_log insert failed');
    });
  });
}
