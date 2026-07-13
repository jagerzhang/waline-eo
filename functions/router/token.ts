import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { verifyPassword } from '../utils/password.js';
import { signJwt } from '../middleware/auth.js';
import { getAvatar } from '../utils/avatar.js';
import { generateSecret, verifyTotp } from '../utils/totp.js';
import { md5 } from '../utils/hash.js';
import { getUserByEmail, updateUser } from '../db/kv-store.js';

export const tokenRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/token - Get current user info
 */
tokenRoutes.get('/', async (c) => {
  const userInfo = c.get('userInfo');
  if (!userInfo) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 401);
  }

  const emailLower = userInfo.email.toLowerCase();
  const [avatar, mailMd5] = await Promise.all([
    userInfo.avatar || getAvatar(userInfo.email),
    md5(emailLower),
  ]);

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      objectId: userInfo.objectId,
      display_name: userInfo.display_name,
      email: userInfo.email,
      type: userInfo.type,
      url: userInfo.url,
      avatar,
      label: userInfo.label || '',
      github: userInfo.github,
      twitter: userInfo.twitter,
      facebook: userInfo.facebook,
      google: userInfo.google,
      weibo: userInfo.weibo,
      qq: userInfo.qq,
      '2fa': userInfo['2fa'] ? true : undefined,
      mailMd5,
    },
  });
});

/**
 * POST /api/token - Login
 */
tokenRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ errno: 1, errmsg: 'email and password are required' }, 400);
  }

  const loginIp = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const loginRateKey = `login_attempts:${loginIp}`;
  let loginAttempts = 0;
  try { loginAttempts = Number(await WALINE_KV.get(loginRateKey) || '0'); } catch {}
  if (loginAttempts >= 5) {
    return c.json({ errno: 1, errmsg: 'Too many login attempts, please try again later' }, 429);
  }
  const recordLoginFailure = async () => {
    try { await WALINE_KV.put(loginRateKey, String(loginAttempts + 1), { expirationTtl: 900 }); } catch {}
  };

  const user = await getUserByEmail(email);

  if (!user) {
    await recordLoginFailure();
    return c.json({ errno: 1, errmsg: 'Invalid email or password' }, 401);
  }

  if ((user.type as string) === 'banned') {
    return c.json({ errno: 1, errmsg: 'User banned' }, 401);
  }

  const valid = await verifyPassword(password, user.password as string);
  if (!valid) {
    await recordLoginFailure();
    return c.json({ errno: 1, errmsg: 'Invalid email or password' }, 401);
  }

  // Check 2FA
  if (user['2fa']) {
    if (!body.code) {
      return c.json({ errno: 1, errmsg: '2FA required', data: { '2fa': true } }, 401);
    }
    const verified2fa = await verifyTotp(user['2fa'] as string, body.code);
    if (!verified2fa) {
      await recordLoginFailure();
      return c.json({ errno: 1, errmsg: 'Two factor auth verify failed, please try again' }, 401);
    }
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ errno: 1, errmsg: 'JWT_SECRET not configured' }, 500);
  }

  const token = await signJwt({ id: user.id as number }, jwtSecret);
  try { await WALINE_KV.delete(loginRateKey); } catch {}

  const userEmail = (user.email as string).toLowerCase();
  const [avatar, mailMd5] = await Promise.all([
    (user.avatar as string) || getAvatar(user.email as string),
    md5(userEmail),
  ]);

  const isSecure = new URL(c.req.url).protocol === 'https:';

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      token,
      objectId: user.id,
      display_name: user.display_name,
      email: user.email,
      type: user.type,
      url: user.url || '',
      avatar,
      label: user.label || '',
      '2fa': user['2fa'] ? true : false,
      mailMd5,
    },
  }, 200, {
    'Set-Cookie': `TOKEN=${encodeURIComponent(token)}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${86400 * 30}`,
  });
});

/**
 * DELETE /api/token - Logout
 */
tokenRoutes.delete('/', async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const rawCookieToken = c.req.header('cookie')?.match(/(?:^|;\s*)TOKEN=([^;]+)/)?.[1];
  let cookieToken = '';
  if (rawCookieToken) {
    try { cookieToken = decodeURIComponent(rawCookieToken); } catch { cookieToken = rawCookieToken; }
  }
  const token = authHeader.replace('Bearer ', '').trim()
    || c.req.query('token')
    || cookieToken
    || '';

  if (token) {
    try {
      // 将 token 加入黑名单，过期时间与 JWT 一致（30天）
      await WALINE_KV.put(`token:blacklist:${token}`, '1', { expirationTtl: 86400 * 30 });
    } catch (e) {
      // 即使黑名单写入失败，也返回成功（不影响用户体验）
    }
  }

  const isSecure = new URL(c.req.url).protocol === 'https:';
  return c.json({ errno: 0, errmsg: '' }, 200, {
    'Set-Cookie': `TOKEN=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`,
  });
});

/**
 * GET /api/token/2fa - Check 2FA status or get 2FA setup info
 */
tokenRoutes.get('/2fa', async (c) => {
  const userInfo = c.get('userInfo');
  const email = c.req.query('email');

  // Public check: is 2FA enabled for a given email?
  if (!userInfo && email) {
    return c.json({
      errno: 0,
      data: { enable: false },
    });
  }

  // Not authenticated and no email param
  if (!userInfo) {
    return c.json({ errno: 0, data: { enable: false } });
  }

  // Authenticated: return 2FA setup info
  const name = `waline_${userInfo.objectId}`;

  if (userInfo['2fa'] && userInfo['2fa'].length === 32) {
    return c.json({
      errno: 0,
      data: {
        otpauth_url: `otpauth://totp/${name}?secret=${userInfo['2fa']}`,
        secret: userInfo['2fa'],
      },
    });
  }

  // Generate new secret for setup
  const secret = generateSecret(20);
  return c.json({
    errno: 0,
    data: {
      otpauth_url: `otpauth://totp/${name}?secret=${secret}`,
      secret,
    },
  });
});

/**
 * POST /api/token/2fa - Verify and enable 2FA
 */
tokenRoutes.post('/2fa', async (c) => {
  const userInfo = c.get('userInfo');
  if (!userInfo) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 401);
  }

  const { secret, code } = await c.req.json();
  if (!secret || !code || !/^\d{6}$/.test(code)) {
    return c.json({ errno: 1, errmsg: 'Invalid 2FA code' }, 400);
  }

  const verified = await verifyTotp(secret, code);
  if (!verified) {
    return c.json({ errno: 1, errmsg: 'Two factor auth verify failed, please try again' }, 401);
  }

  await updateUser(userInfo.objectId, { '2fa': secret });

  return c.json({ errno: 0, errmsg: '' });
});
