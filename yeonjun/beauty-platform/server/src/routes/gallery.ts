import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAsUser, supabaseAdmin } from '../lib/supabase.js';
import { deleteFromStorage, AI_BUCKET } from '../lib/storage.js';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export default async function galleryRoutes(app: FastifyInstance) {
  app.get('/v1/gallery', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_FAILED', message: parsed.error.message });

    const sb = supabaseAsUser(req.accessToken!);
    let q = sb
      .from('generated_images')
      .select('id, image_url, thumbnail_url, prompt, style, created_at')
      .order('created_at', { ascending: false })
      .limit(parsed.data.limit + 1);
    if (parsed.data.cursor) q = q.lt('created_at', parsed.data.cursor);

    const { data, error } = await q;
    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });

    const hasMore = data.length > parsed.data.limit;
    const items = hasMore ? data.slice(0, parsed.data.limit) : data;
    return {
      items: items.map((i) => ({
        id: i.id,
        imageUrl: i.image_url,
        thumbnailUrl: i.thumbnail_url,
        prompt: i.prompt,
        style: i.style,
        createdAt: i.created_at,
      })),
      nextCursor: hasMore ? items[items.length - 1].created_at : null,
    };
  });

  app.delete('/v1/gallery/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const { data: row, error: selErr } = await supabaseAdmin
      .from('generated_images')
      .select('object_key, user_id')
      .eq('id', id)
      .single();
    if (selErr || !row) return reply.code(404).send({ code: 'NOT_FOUND', message: 'image not found' });
    if (row.user_id !== req.userId) return reply.code(403).send({ code: 'FORBIDDEN', message: 'not owner' });

    await deleteFromStorage(AI_BUCKET, [row.object_key]).catch((e) => {
      app.log.warn({ err: e, key: row.object_key }, 'storage delete failed; will reconcile');
    });
    const { error: delErr } = await supabaseAdmin.from('generated_images').delete().eq('id', id);
    if (delErr) return reply.code(500).send({ code: 'DB_ERROR', message: delErr.message });

    return reply.code(204).send();
  });
}
