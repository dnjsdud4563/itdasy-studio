import type { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAsUser } from '../lib/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    accessToken?: string;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'missing bearer token' });
  }
  const token = header.slice(7);
  const sb = supabaseAsUser(token);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    return reply.code(401).send({ code: 'AUTH_REQUIRED', message: 'invalid token' });
  }
  req.userId = data.user.id;
  req.accessToken = token;
}
