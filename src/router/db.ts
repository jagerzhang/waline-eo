/**
 * Database export/import routes - compatible with Waline admin migration panel
 * GET  /api/db                         - Export all data
 * POST /api/db?table=Comment           - Insert a row
 * PUT  /api/db?table=Comment&objectId=1 - Update a row
 * DELETE /api/db?table=Comment         - Clear a table
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import {
  getAllComments,
  getAllCounters,
  getAllUsers,
  clearComments,
  clearCounters,
  clearUsers,
  createComment,
  createUser,
  createCounter,
  updateComment,
  updateUser,
  updateCounter,
  getCommentById,
  getUserById,
  getCounterByUrl,
} from '../db/kv-store.js';

export const dbRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const VALID_COUNTER_FIELDS = new Set([
  'time', 'reaction0', 'reaction1', 'reaction2', 'reaction3',
  'reaction4', 'reaction5', 'reaction6', 'reaction7', 'reaction8',
]);

// Table name mapping: Waline logical name -> KV table name
const TABLE_MAP: Record<string, string> = {
  Comment: 'wl_Comment',
  Counter: 'wl_Counter',
  Users: 'wl_Users',
};

// Allowed column names per table (prevents SQL injection via dynamic column names)
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  Comment: new Set([
    'user_id', 'comment', 'orig', 'insertedAt', 'ip', 'link', 'mail', 'nick',
    'pid', 'rid', 'sticky', 'status', 'like', 'ua', 'url', 'createdAt', 'updatedAt',
  ]),
  Counter: new Set([
    'time', 'reaction0', 'reaction1', 'reaction2', 'reaction3', 'reaction4',
    'reaction5', 'reaction6', 'reaction7', 'reaction8', 'url', 'createdAt', 'updatedAt',
  ]),
  Users: new Set([
    'display_name', 'email', 'password', 'type', 'label', 'url', 'avatar',
    'github', 'twitter', 'facebook', 'google', 'weibo', 'qq', '2fa', 'createdAt', 'updatedAt',
  ]),
};

// Admin-only guard
dbRoutes.use('*', async (c, next) => {
  const userInfo = c.get('userInfo');
  if (!userInfo) return c.json({ errno: 401, errmsg: 'Unauthorized' }, 401);
  if (userInfo.type !== 'administrator') return c.json({ errno: 403, errmsg: 'Forbidden' }, 403);
  await next();
});

/**
 * GET /api/db - Export all tables in Waline format
 * Admin panel's request() unwraps: { __version, ...result.data }
 */
dbRoutes.get('/', async (c) => {
  const exportData: any = {
    type: 'waline',
    version: 1,
    time: Date.now(),
    tables: ['Comment', 'Counter', 'Users'],
    data: {
      Comment: [],
      Counter: [],
      Users: [],
    },
  };

  const comments = await getAllComments();
  exportData.data.Comment = comments.map((row: any) => ({
    ...row,
    objectId: String(row.id),
  }));

  const counters = await getAllCounters();
  exportData.data.Counter = counters.map((row: any) => ({
    ...row,
    objectId: String(row.id),
  }));

  const users = await getAllUsers();
  exportData.data.Users = users.map((row: any) => ({
    ...row,
    objectId: String(row.id),
  }));

  return c.json({ errno: 0, data: exportData });
});

/**
 * POST /api/db?table=Comment - Insert a row into the specified table
 * Must return { errno: 0, data: { objectId } } for admin panel idMaps
 */
dbRoutes.post('/', async (c) => {
  const table = c.req.query('table');
  if (!table || !TABLE_MAP[table]) {
    return c.json({ errno: 1, errmsg: 'Invalid table' }, 400);
  }

  const allowedCols = ALLOWED_COLUMNS[table];
  const body = await c.req.json();

  // Remove auto-generated fields
  delete body.objectId;
  delete body.id;

  // Only keep allowed, non-null columns
  const keys = Object.keys(body).filter(
    (k) => allowedCols.has(k) && body[k] !== null && body[k] !== undefined,
  );
  if (keys.length === 0) {
    return c.json({ errno: 1, errmsg: 'Empty data' }, 400);
  }

  const data: Record<string, any> = {};
  for (const k of keys) {
    data[k] = body[k];
  }

  let created: any;
  if (table === 'Comment') {
    created = await createComment(data);
  } else if (table === 'Counter') {
    // Create counter with all provided fields
    const url = data.url || '';
    const initField = Object.keys(data).find((k) => k !== 'url' && k !== 'id' && VALID_COUNTER_FIELDS.has(k)) || 'time';
    const initValue = typeof data[initField] === 'number' ? data[initField] : (parseInt(String(data[initField])) || 1);
    // Override createCounter's default value with imported value
    created = await createCounter(url, initField);
    if (initValue !== 1) {
      await updateCounter(url, initField, initValue);
    }
    // Apply remaining fields
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'url' && k !== 'id' && VALID_COUNTER_FIELDS.has(k) && k !== initField) {
        await updateCounter(url, k, typeof v === 'number' ? v : parseInt(String(v)) || 0);
      }
    }
  } else if (table === 'Users') {
    created = await createUser(data);
  }

  if (!created) {
    return c.json({ errno: 1, errmsg: 'Insert failed' }, 500);
  }

  return c.json({ errno: 0, data: { objectId: String(created.id) } });
});

/**
 * PUT /api/db?table=Comment&objectId=1 - Update a row
 */
dbRoutes.put('/', async (c) => {
  const table = c.req.query('table');
  const objectId = c.req.query('objectId');
  if (!table || !TABLE_MAP[table] || !objectId) {
    return c.json({ errno: 1, errmsg: 'Invalid table or objectId' }, 400);
  }

  const allowedCols = ALLOWED_COLUMNS[table];
  const body = await c.req.json();

  // Don't update these fields
  delete body.objectId;
  delete body.id;
  delete body.createdAt;

  const keys = Object.keys(body).filter(
    (k) => allowedCols.has(k) && body[k] !== null && body[k] !== undefined,
  );
  if (keys.length === 0) {
    return c.json({ errno: 0 });
  }

  const data: Record<string, any> = {};
  for (const k of keys) {
    data[k] = body[k];
  }

  const id = Number(objectId);
  if (table === 'Comment') {
    await updateComment(id, data);
  } else if (table === 'Counter') {
    const { getCounterById } = await import('../db/kv-store.js');
    const counter = await getCounterById(id);
    if (counter) {
      for (const [k, v] of Object.entries(data)) {
        if (k !== 'url' && k !== 'id' && VALID_COUNTER_FIELDS.has(k)) {
          await updateCounter(counter.url, k, typeof v === 'number' ? v : parseInt(String(v)) || 0);
        }
      }
    }
  } else if (table === 'Users') {
    await updateUser(id, data);
  }

  return c.json({ errno: 0 });
});

/**
 * DELETE /api/db?table=Comment - Clear all rows from a table
 */
dbRoutes.delete('/', async (c) => {
  const table = c.req.query('table');
  if (!table || !TABLE_MAP[table]) {
    return c.json({ errno: 1, errmsg: 'Invalid table' }, 400);
  }

  if (table === 'Comment') {
    await clearComments();
  } else if (table === 'Counter') {
    await clearCounters();
  } else if (table === 'Users') {
    await clearUsers();
  }

  return c.json({ errno: 0 });
});
