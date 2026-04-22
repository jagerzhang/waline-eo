import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getCounterByUrl, getCountersByUrls, createCounter, updateCounter } from '../db/kv-store.js';

export const articleRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Valid counter fields to prevent SQL injection
const VALID_FIELDS = new Set([
  'time',
  'reaction0',
  'reaction1',
  'reaction2',
  'reaction3',
  'reaction4',
  'reaction5',
  'reaction6',
  'reaction7',
  'reaction8',
]);

/**
 * GET /api/article
 * Query params:
 *   - path / path[] (required): page path(s)
 *   - type / type[] (optional, default: ['time']): counter field(s)
 *
 * Response (follows Waline /api/ format):
 *   - single path: [{[type]: count}]
 *   - multiple paths: [{[type]: count}, …]
 */
articleRoutes.get('/', async (c) => {
  const paths = c.req.queries('path') || c.req.queries('path[]') || [];
  if (paths.length === 0) {
    return c.json({ errno: 0, errmsg: '', data: 0 });
  }

  const types = c.req.queries('type') || c.req.queries('type[]') || ['time'];
  const validTypes = types.filter((t) => VALID_FIELDS.has(t));
  if (validTypes.length === 0) {
    return c.json({ errno: 0, errmsg: '', data: paths.map(() => ({})) });
  }

  const counters = await getCountersByUrls(paths);

  const respObj: Record<string, any> = {};
  for (const row of counters) {
    respObj[row.url] = row;
  }

  const data = paths.map((url) => {
    const counters: Record<string, number> = {};
    for (const field of validTypes) {
      counters[field] = (respObj[url] as any)?.[field] || 0;
    }
    return counters;
  });

  return c.json({ errno: 0, errmsg: '', data });
});

/**
 * POST /api/article
 * Body: { path, type, action }
 *   - path: page path (maps to DB url column)
 *   - type: counter field (e.g. 'time', 'reaction0')
 *   - action: 'inc' | 'desc'
 */
articleRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { path, type = 'time', action = 'inc' } = body;

  if (!path) {
    return c.json({ errno: 1, errmsg: 'path is required' }, 400);
  }

  if (!VALID_FIELDS.has(type)) {
    return c.json({ errno: 1, errmsg: 'invalid type' }, 400);
  }

  const existing = await getCounterByUrl(path);

  if (!existing) {
    if (action === 'desc') {
      return c.json({ errno: 0, errmsg: '', data: [{ [type]: 0 }] });
    }

    await createCounter(path, type);

    return c.json({ errno: 0, errmsg: '', data: [{ [type]: 1 }] });
  }

  const currentVal = (existing as any)[type] || 0;
  const newVal = action === 'desc' ? Math.max(0, currentVal - 1) : currentVal + 1;

  await updateCounter(path, type, newVal);

  return c.json({ errno: 0, errmsg: '', data: [{ [type]: newVal }] });
});
