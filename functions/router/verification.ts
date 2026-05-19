import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getUserByEmail, updateUser } from '../db/kv-store.js';

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

  const user = await getUserByEmail(email);
  if (!user) {
    return c.json({ errno: 1, errmsg: 'User not found' }, 404);
  }

  const typeStr = user.type as string;
  const match = typeStr.match(/^verify:(\d{4}):(\d+)$/i);

  if (!match) {
    // Already verified
    return c.redirect('/ui/login');
  }

  const [, savedToken, expiry] = match;

  if (token === savedToken && Date.now() < parseInt(expiry, 10)) {
    await updateUser(user.id as number, { type: 'guest' });
    return c.redirect('/ui/login');
  }

  return c.json({ errno: 1, errmsg: 'Token expired or invalid' }, 400);
});
