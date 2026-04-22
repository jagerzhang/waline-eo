import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { getAvatar } from '../utils/avatar.js';
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
    const user = await getUserByEmail(c.env.KV, emailQuery);
    if (user) {
      return c.json({ errno: 0, objectId: String(user.id), ...user });
    }
    return c.json({ errno: 0 });
  }

  if (isAdmin) {
    const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10') || 10));
    const offset = (page - 1) * pageSize;

    const total = await getUserCount(c.env.KV);

    const { data } = await getUsers(c.env.KV, { limit: pageSize, offset });

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
  const result = await getTopCommenters(c.env.KV, count);

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

  // Check if email exists
  const existing = await getUserByEmail(c.env.KV, email);

  if (existing) {
    return c.json({ errno: 1, errmsg: 'Registration failed' }, 409);
  }

  // Check if first user (becomes admin)
  const userCount = await getUserCount(c.env.KV);
  const isFirst = userCount === 0;

  const hashedPassword = await hashPassword(password);

  const newUser = await createUser(c.env.KV, {
    display_name: display_name || email.split('@')[0],
    email,
    password: hashedPassword,
    type: isFirst ? 'administrator' : 'guest',
    url: url || '',
  });

  return c.json({
    errno: 0,
    errmsg: '',
    data: await formatUser(newUser),
  }, 201);
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

  const updated = await updateUser(c.env.KV, id, updates);

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
  const target = await getUserById(c.env.KV, id);

  if (!target) {
    return c.json({ errno: 1, errmsg: 'User not found' }, 404);
  }

  if ((target.type as string).startsWith('verify:') || target.type === 'guest') {
    // Unverified or guest: hard delete
    await deleteUserById(c.env.KV, id);
  } else {
    // Verified: ban
    await updateUser(c.env.KV, id, { type: 'banned' });
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
