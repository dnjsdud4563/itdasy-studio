import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { encryptPII, decryptPII } from '../lib/crypto.js';
import {
  getAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  refreshToken,
  getUserProfile,
  getUserMedia,
  parseSignedRequest,
} from '../lib/meta-api.js';

async function getValidToken(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('meta_connections')
    .select('access_token_cipher, token_expires_at')
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new Error('Instagram not connected');
  let token = decryptPII(data.access_token_cipher);

  // 만료 7일 전 자동 갱신
  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Date.now() > expiresAt - 7 * 24 * 3600 * 1000) {
    const refreshed = await refreshToken(token);
    token = refreshed.accessToken;
    await supabaseAdmin.from('meta_connections').update({
      access_token_cipher: encryptPII(token),
      token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    }).eq('user_id', userId);
  }
  return token;
}

export default async function metaRoutes(app: FastifyInstance) {
  // OAuth 시작 URL 반환
  app.get('/v1/meta/auth', { preHandler: requireAuth }, async (req) => {
    const state = `${req.userId}:${randomUUID()}`;
    return { url: getAuthUrl(state) };
  });

  // OAuth 콜백
  app.get('/v1/meta/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return reply.code(400).send({ code: 'MISSING_PARAMS' });

    const userId = state.split(':')[0];
    if (!userId) return reply.code(400).send({ code: 'INVALID_STATE' });

    const short = await exchangeCodeForToken(code);
    const long = await getLongLivedToken(short.accessToken);
    const profile = await getUserProfile(long.accessToken);

    await supabaseAdmin.from('meta_connections').upsert({
      user_id: userId,
      ig_user_id: profile.id,
      ig_username: profile.username,
      access_token_cipher: encryptPII(long.accessToken),
      token_expires_at: new Date(Date.now() + long.expiresIn * 1000).toISOString(),
      scopes: 'instagram_basic,user_profile,user_media',
    });

    // 성공 후 앱으로 리다이렉트 (딥링크)
    return reply.redirect(`beauty://meta/connected?username=${profile.username}`);
  });

  // IG 프로필 조회
  app.get('/v1/meta/profile', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const token = await getValidToken(req.userId!);
      const profile = await getUserProfile(token);
      return profile;
    } catch (e) {
      return reply.code(404).send({ code: 'NOT_CONNECTED', message: 'Instagram not connected' });
    }
  });

  // IG 피드 조회
  app.get('/v1/meta/feed', { preHandler: requireAuth }, async (req, reply) => {
    const { limit, after } = req.query as { limit?: string; after?: string };
    try {
      const token = await getValidToken(req.userId!);
      const result = await getUserMedia(token, Number(limit) || 20, after);
      return result;
    } catch (e) {
      return reply.code(404).send({ code: 'NOT_CONNECTED', message: 'Instagram not connected' });
    }
  });

  // 연동 해제
  app.delete('/v1/meta/disconnect', { preHandler: requireAuth }, async (req, reply) => {
    await supabaseAdmin.from('meta_connections').delete().eq('user_id', req.userId!);
    return reply.code(204).send();
  });

  // Meta Data Deletion Callback (심사 필수 — Meta가 호출)
  app.post('/v1/meta/data-deletion', async (req, reply) => {
    const { signed_request } = req.body as { signed_request?: string };
    if (!signed_request) return reply.code(400).send({ error: 'missing signed_request' });

    const parsed = parseSignedRequest(signed_request);
    if (!parsed) return reply.code(400).send({ error: 'invalid signed_request' });

    // IG user_id로 연결 삭제
    await supabaseAdmin.from('meta_connections').delete().eq('ig_user_id', parsed.user_id);

    const confirmationCode = randomUUID();
    return {
      url: `https://wlwauinqvmegnqdtbrtg.supabase.co/functions/v1/serve-legal?doc=deletion&code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    };
  });
}
