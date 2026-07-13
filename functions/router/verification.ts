import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getUserByEmail, updateUser } from '../db/kv-store.js';
import { parseVerificationState, timingSafeStringEqual } from '../utils/verification-code.js';

export const verificationRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/verification - Verify email registration token
 * Query params: token, email
 */
verificationRoutes.get('/', async (c) => {
  const token = c.req.query('token');
  const email = c.req.query('email');

  if (!token || !email) {
    return c.json({ errno: 1, errmsg: 'token and email are required' }, 400);
  }

  const clientIp = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateKey = `verify_limit:${clientIp}:${email.toLowerCase()}`;
  const attempts = Number(await WALINE_KV.get(rateKey) || '0');
  if (attempts >= 10) {
    return c.json({ errno: 1, errmsg: 'Too many verification attempts, please try again later' }, 429);
  }
  await WALINE_KV.put(rateKey, String(attempts + 1), { expirationTtl: 900 });

  const user = await getUserByEmail(email);
  if (!user) {
    return c.json({ errno: 1, errmsg: 'Token expired or invalid' }, 400);
  }

  const typeStr = user.type as string;
  const state = parseVerificationState(typeStr);

  if (!state) {
    // Already verified
    return c.redirect('/ui/login');
  }

  if (timingSafeStringEqual(token, state.token) && Date.now() < state.expiresAt) {
    await updateUser(user.id as number, { type: 'guest' });
    try { await WALINE_KV.delete(rateKey); } catch {}
    return c.redirect('/ui/login');
  }

  return c.json({ errno: 1, errmsg: 'Token expired or invalid' }, 400);
});
