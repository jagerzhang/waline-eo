import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateNumericVerificationCode } from '../utils/verification-code.js';
import { getAvatar } from '../utils/avatar.js';
import { signJwt } from '../middleware/auth.js';
import { getSetting, getSettings } from './settings.js';
import { sendMail, buildMailSubject, buildMailHtml } from '../utils/mail.js';
import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUserById,
  getUsers,
  getUserCount,
  getTopCommenters,
} from '../db/kv-store.js';

function escapeHtmlEmail(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const userRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/user
 * Get user list
 * Public: top commenters by count
 * Admin: paginated user list
 */
userRoutes.get('/', async (c) => {
  const userInfo = c.get('userInfo');
  const isAdmin = userInfo?.type === 'administrator';

  // Admin: lookup user by email (used by import flow)
  const emailQuery = c.req.query('email');
  if (isAdmin && emailQuery) {
    const user = await getUserByEmail(emailQuery);
    if (user) {
      return c.json({ errno: 0, objectId: String(user.id), ...user });
    }
    return c.json({ errno: 0 });
  }

  if (isAdmin) {
    const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10') || 10));
    const offset = (page - 1) * pageSize;

    const [total, { data }] = await Promise.all([
      getUserCount(),
      getUsers({ limit: pageSize, offset }),
    ]);

    return c.json({
      errno: 0,
      errmsg: '',
      data: {
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        data: await Promise.all(data.map((u: any) => formatUser(u))),
      },
    });
  }

  // Public: top commenters
  const count = Math.min(50, Math.max(1, parseInt(c.req.query('count') || '10') || 10));
  const result = await getTopCommenters(count);

  return c.json({
    errno: 0,
    errmsg: '',
    data: result.map((item: any) => ({
      objectId: item.user.id,
      display_name: item.user.display_name,
      url: item.user.url || '',
      avatar: item.user.avatar || '',
      label: item.user.label || '',
      count: item.comment_count,
    })),
  });
});

/**
 * POST /api/user - Register
 */
userRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { display_name, email, password, url } = body;

  if (!email || !password) {
    return c.json({ errno: 1, errmsg: 'email and password are required' }, 400);
  }

  // Rate limit registration: 1 attempt per IP per 60 seconds
  const regIp = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || `noip:${email}`;
  const regKey = `reg_limit:${regIp}`;
  const recent = await WALINE_KV.get(regKey);
  if (recent) {
    return c.json({ errno: 1, errmsg: '注册太频繁，请稍后再试' }, 429);
  }
  await WALINE_KV.put(regKey, '1', { expirationTtl: 60 });

  // Check if email exists (allow re-registration of unverified users)
  const existing = await getUserByEmail(email);

  if (existing && ['administrator', 'guest'].includes(existing.type as string)) {
    // Don't reveal whether email exists — return uniform success
    return c.json({ errno: 0, errmsg: '' }, 201);
  }

  // Check if first user (becomes admin)
  const userCount = await getUserCount();
  const isFirst = userCount === 0;

  // Check if SMTP is configured for email verification
  const settingKeys = [
    'smtp_service', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
    'sender_name', 'sender_email', 'site_name', 'site_url',
  ];
  const kvSettings = await getSettings(settingKeys);
  const cfg = (key: string) => kvSettings[key] || (c.env as any)[key.toUpperCase()] || '';
  const hasMailService = cfg('smtp_host') || cfg('smtp_service');

  const token = generateNumericVerificationCode(6);
  const normalType = hasMailService
    ? `verify:${token}:${Date.now() + 1 * 60 * 60 * 1000}`
    : 'guest';

  const hashedPassword = await hashPassword(password);
  const userData = {
    display_name: display_name || email.split('@')[0],
    email,
    password: hashedPassword,
    type: isFirst ? 'administrator' : normalType,
    url: url || '',
  };

  let newUser;
  if (existing) {
    // Re-register unverified user
    newUser = await updateUser(existing.id as number, userData);
  } else {
    newUser = await createUser(userData);
  }

  // If verification needed, send email
  if (!isFirst && hasMailService) {
    const siteName = cfg('site_name') || 'Waline';
    const serverUrl = new URL(c.req.url).origin;
    const verifyUrl = `${serverUrl}/api/verification?token=${token}&email=${encodeURIComponent(email)}`;
    const safeVerifyUrl = escapeHtmlEmail(verifyUrl);

    const mailConfig = {
      smtpService: cfg('smtp_service'),
      smtpHost: cfg('smtp_host'),
      smtpPort: cfg('smtp_port'),
      smtpSecure: cfg('smtp_secure'),
      smtpUser: cfg('smtp_user'),
      smtpPass: cfg('smtp_pass'),
      senderName: cfg('sender_name'),
      senderEmail: cfg('sender_email'),
    };

    try {
      await sendMail(mailConfig, {
        to: email,
        subject: `[${siteName}] 注册确认 / Registration Confirm`,
        html: `<p>请点击以下链接确认注册，链接有效期 1 小时：</p><p><a href="${safeVerifyUrl}">${safeVerifyUrl}</a></p><p>如果您没有注册，请忽略此邮件。</p>`,
      });
    } catch (e) {
      console.error('[Verify Mail Error]', e);
      return c.json({ errno: 1, errmsg: 'Failed to send verification email' }, 500);
    }

    return c.json({ errno: 0, errmsg: '', data: { verify: true } }, 201);
  }

  return c.json({
    errno: 0,
    errmsg: '',
    data: await formatUser(newUser),
  }, 201);
});

/**
 * PUT /api/user/password - Request password reset email
 * MUST be defined before PUT /:id to avoid route conflict
 */
userRoutes.put('/password', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email) {
    return c.json({ errno: 1, errmsg: 'email is required' }, 400);
  }

  // Check mail service availability
  const settingKeys = [
    'smtp_service', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
    'sender_name', 'sender_email', 'site_name', 'site_url',
  ];
  const kvSettings = await getSettings(settingKeys);
  const cfg = (key: string) => kvSettings[key] || (c.env as any)[key.toUpperCase()] || '';

  const hasMailService = cfg('smtp_host') || cfg('smtp_service');
  if (!hasMailService) {
    return c.json({ errno: 1, errmsg: 'Mail service not configured' }, 500);
  }

  const user = await getUserByEmail(email);
  if (!user) {
    // Don't reveal whether email exists — return success silently
    return c.json({ errno: 0, errmsg: '' });
  }

  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ errno: 1, errmsg: 'JWT secret not configured' }, 500);
  }

  // Generate a one-time reset code stored in KV (not exposed in URL)
  const resetCode = Array.from(
    crypto.getRandomValues(new Uint8Array(24)),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');
  const jwtToken = await signJwt({ id: user.id as number }, jwtSecret, 3600);
  await WALINE_KV.put(`reset:${resetCode}`, jwtToken, { expirationTtl: 3600 });

  const siteName = cfg('site_name') || 'Waline';
  const serverUrl = new URL(c.req.url).origin;
  // Use one-time code (not JWT) in the URL to prevent token leakage via browser history/logs
  const resetUrl = `${serverUrl}/api/reset-redirect?code=${resetCode}`;
  const safeResetUrl = escapeHtmlEmail(resetUrl);

  const mailConfig = {
    smtpService: cfg('smtp_service'),
    smtpHost: cfg('smtp_host'),
    smtpPort: cfg('smtp_port'),
    smtpSecure: cfg('smtp_secure'),
    smtpUser: cfg('smtp_user'),
    smtpPass: cfg('smtp_pass'),
    senderName: cfg('sender_name'),
    senderEmail: cfg('sender_email'),
  };

  try {
    await sendMail(mailConfig, {
      to: email,
      subject: `[${siteName}] 重置密码 / Reset Password`,
      html: `<p>请点击以下链接登录并修改密码：</p><p><a href="${safeResetUrl}">${safeResetUrl}</a></p><p>此链接将在 1 小时后失效。</p>`,
    });
  } catch (e) {
    console.error('[Password Reset Mail Error]', e);
    return c.json({ errno: 1, errmsg: 'Failed to send email' }, 500);
  }

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * PUT /api/user/:id - Update user profile
 */
userRoutes.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const userInfo = c.get('userInfo');

  if (!userInfo) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 401);
  }

  const isAdmin = userInfo.type === 'administrator';
  const isSelf = userInfo.objectId === id;

  if (!isAdmin && !isSelf) {
    return c.json({ errno: 1, errmsg: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const updates: Partial<any> = {};

  const allowedFields = ['display_name', 'url', 'avatar', 'label'];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (body.password) {
    updates.password = await hashPassword(body.password);
  }

  // Admin-only fields
  if (isAdmin && body.type !== undefined) {
    updates.type = body.type;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ errno: 1, errmsg: 'No fields to update' }, 400);
  }

  const updated = await updateUser(id, updates);

  return c.json({ errno: 0, errmsg: '', data: await formatUser(updated) });
});

/**
 * DELETE /api/user/:id - Delete/ban user
 */
userRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const userInfo = c.get('userInfo');

  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  // Ban verified users, delete unverified
  const target = await getUserById(id);

  if (!target) {
    return c.json({ errno: 1, errmsg: 'User not found' }, 404);
  }

  if ((target.type as string).startsWith('verify:')) {
    // Unverified: hard delete
    await deleteUserById(id);
  } else {
    // Verified, guest, or other: ban
    await updateUser(id, { type: 'banned' });
  }

  return c.json({ errno: 0, errmsg: '' });
});

async function formatUser(row: any) {
  if (!row) return null;
  return {
    objectId: row.id,
    display_name: row.display_name || '',
    email: row.email || '',
    type: row.type || 'guest',
    url: row.url || '',
    avatar: row.avatar || await getAvatar(row.email || ''),
    label: row.label || '',
  };
}
