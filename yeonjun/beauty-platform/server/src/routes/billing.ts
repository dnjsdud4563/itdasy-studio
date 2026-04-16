import type { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase.js';
import { config } from '../config.js';

function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type RCEvent = {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    entitlement_ids?: string[];
    expiration_at_ms?: number;
    original_transaction_id?: string;
  };
};

export default async function billingRoutes(app: FastifyInstance) {
  app.get('/v1/billing/entitlements', { preHandler: requireAuth }, async (req, reply) => {
    const sb = supabaseAsUser(req.accessToken!);
    const { data, error } = await sb
      .from('entitlements')
      .select('plan, source, renew_at')
      .eq('user_id', req.userId!)
      .single();
    if (error) return reply.code(404).send({ code: 'NOT_FOUND', message: error.message });

    const { data: prof } = await sb.from('profiles').select('credits_remaining').eq('id', req.userId!).single();

    return {
      plan: data.plan,
      source: data.source,
      renewAt: data.renew_at,
      creditsRemaining: prof?.credits_remaining ?? 0,
      features: data.plan === 'free' ? ['basic_generation'] : ['unlimited_generation', 'premium_styles'],
    };
  });

  // RevenueCat webhook
  app.post('/v1/billing/webhooks/revenuecat', { config: { rawBody: true } }, async (req, reply) => {
    const raw = (req as unknown as { rawBody: string }).rawBody ?? JSON.stringify(req.body);
    const sig = (req.headers['authorization'] ?? '') as string;
    // RevenueCat은 Authorization 헤더에 shared secret을 그대로 넣음.
    if (sig !== `Bearer ${config.REVENUECAT_WEBHOOK_SECRET}`) {
      return reply.code(401).send({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    }

    const body = JSON.parse(raw) as RCEvent;
    const ev = body.event;

    // Idempotency
    const { data: existed } = await supabaseAdmin.from('webhook_events').select('id').eq('id', ev.id).maybeSingle();
    if (existed) return reply.code(200).send({ ok: true, deduped: true });

    await supabaseAdmin.from('webhook_events').insert({ id: ev.id, provider: 'revenuecat', payload: body });

    const plan = ev.entitlement_ids?.includes('premium_yearly')
      ? 'premium_yearly'
      : ev.entitlement_ids?.includes('premium_monthly')
      ? 'premium_monthly'
      : 'free';

    const renewAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;

    await supabaseAdmin.from('entitlements').upsert({
      user_id: ev.app_user_id,
      plan,
      source: 'revenuecat',
      renew_at: renewAt,
      original_transaction_id: ev.original_transaction_id ?? null,
    });
    await supabaseAdmin.from('profiles').update({ plan }).eq('id', ev.app_user_id);

    return reply.code(200).send({ ok: true });
  });

  // PortOne webhook (국내 웹 결제)
  app.post('/v1/billing/webhooks/portone', { config: { rawBody: true } }, async (req, reply) => {
    const raw = (req as unknown as { rawBody: string }).rawBody ?? JSON.stringify(req.body);
    const sig = (req.headers['x-portone-signature'] ?? '') as string;
    if (!sig || !verifyHmac(raw, sig, config.PORTONE_WEBHOOK_SECRET)) {
      return reply.code(401).send({ code: 'WEBHOOK_SIGNATURE_INVALID' });
    }

    const body = JSON.parse(raw) as {
      imp_uid: string;
      merchant_uid: string;
      status: string;
      custom_data?: { userId?: string; plan?: string };
    };

    // TODO(W2): PortOne API로 결제 재검증 (imp_uid → GET /payments/{imp_uid})
    const { data: existed } = await supabaseAdmin
      .from('webhook_events')
      .select('id')
      .eq('id', body.imp_uid)
      .maybeSingle();
    if (existed) return reply.code(200).send({ ok: true, deduped: true });

    await supabaseAdmin
      .from('webhook_events')
      .insert({ id: body.imp_uid, provider: 'portone', payload: body });

    if (body.status === 'paid' && body.custom_data?.userId && body.custom_data?.plan) {
      await supabaseAdmin.from('entitlements').upsert({
        user_id: body.custom_data.userId,
        plan: body.custom_data.plan,
        source: 'portone',
      });
      await supabaseAdmin
        .from('profiles')
        .update({ plan: body.custom_data.plan })
        .eq('id', body.custom_data.userId);
    }
    return reply.code(200).send({ ok: true });
  });
}
