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
  importCounter,
  updateComment,
  updateUser,
  updateCounter,
  getCounterById,
  rebuildCommentIndexes,
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
    __version: '1.31.13',
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
    user_id: row.user_id ?? null,
    comment: row.comment ?? '',
    orig: row.orig || row.comment || '',
    insertedAt: row.insertedAt ?? '',
    ip: row.ip ?? '',
    link: row.link ?? '',
    mail: row.mail ?? '',
    nick: row.nick ?? '',
    pid: row.pid ?? null,
    rid: row.rid ?? null,
    sticky: row.sticky ?? null,
    status: row.status ?? 'approved',
    like: row.like ?? null,
    ua: row.ua ?? '',
    url: row.url ?? '',
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
    objectId: row.id,
  }));

  const counters = await getAllCounters();
  exportData.data.Counter = counters.map((row: any) => ({
    time: row.time ?? 0,
    reaction0: row.reaction0 ?? 0,
    reaction1: row.reaction1 ?? 0,
    reaction2: row.reaction2 ?? 0,
    reaction3: row.reaction3 ?? 0,
    reaction4: row.reaction4 ?? 0,
    reaction5: row.reaction5 ?? 0,
    reaction6: row.reaction6 ?? 0,
    reaction7: row.reaction7 ?? 0,
    reaction8: row.reaction8 ?? 0,
    url: row.url ?? '',
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
    objectId: row.id,
  }));

  const users = await getAllUsers();
  exportData.data.Users = users.map((row: any) => ({
    display_name: row.display_name ?? '',
    email: row.email ?? '',
    password: row.password ?? '',
    type: row.type ?? 'guest',
    label: row.label ?? '',
    url: row.url ?? '',
    avatar: row.avatar || null,
    github: row.github || null,
    twitter: row.twitter || null,
    facebook: row.facebook || null,
    google: row.google || null,
    weibo: row.weibo || null,
    qq: row.qq || null,
    '2fa': row['2fa'] || null,
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
    objectId: row.id,
  }));

  return c.json({ errno: 0, data: exportData });
});

/**
 * POST /api/db/rebuild-comment-indexes - Rebuild KV derived indexes from comment:* source rows
 */
dbRoutes.post('/rebuild-comment-indexes', async (c) => {
  const result = await rebuildCommentIndexes();
  return c.json({
    errno: 0,
    errmsg: `评论索引重建完成：扫描 ${result.comments} 条评论，文章 ${result.urls} 篇，子评论楼层 ${result.childThreads} 组。`,
    data: result,
  });
});

/**
 * POST /api/db?table=Comment - Insert row(s) into the specified table
 *
 * Single mode (body = field object, used by the admin panel):
 *   request  { ...fields }
 *   response { errno: 0, data: { objectId } }
 *
 * Batch mode (body = { table, rows }, used for imports):
 *   request  { table: 'Comment', rows: [{ ... }, ...] }
 *   response { errno: 0, data: { count, failed, errors } }
 */
async function insertRow(
  table: string,
  allowedCols: Set<string>,
  body: any,
  keepObjectId: boolean,
): Promise<any> {
  if (!body || typeof body !== 'object') throw new Error('Empty data');

  // Batch import keeps the original objectId so pid/rid/user_id references stay valid
  let forcedId: number | null = null;
  if (keepObjectId) {
    const raw = body.objectId ?? body.id;
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) forcedId = parsed;
  }
  delete body.objectId;
  delete body.id;

  // Only keep allowed, non-null columns
  const keys = Object.keys(body).filter(
    (k) => allowedCols.has(k) && body[k] !== null && body[k] !== undefined,
  );
  if (keys.length === 0) throw new Error('Empty data');

  const data: Record<string, any> = {};
  for (const k of keys) {
    data[k] = body[k];
  }
  if (forcedId !== null) data.id = forcedId;

  if (table === 'Comment') {
    return createComment(data);
  }
  if (table === 'Counter') {
    // Import: write the full record as-is, keeping historical timestamps
    const url = data.url || '';
    if (!url) throw new Error('Counter missing url');
    const toNum = (v: any) => (typeof v === 'number' ? v : parseInt(String(v)) || 0);
    return importCounter({
      id: forcedId ?? undefined,
      url,
      time:      toNum(data.time),
      reaction0: toNum(data.reaction0),
      reaction1: toNum(data.reaction1),
      reaction2: toNum(data.reaction2),
      reaction3: toNum(data.reaction3),
      reaction4: toNum(data.reaction4),
      reaction5: toNum(data.reaction5),
      reaction6: toNum(data.reaction6),
      reaction7: toNum(data.reaction7),
      reaction8: toNum(data.reaction8),
      createdAt: data.createdAt || undefined,
      updatedAt: data.updatedAt || undefined,
    });
  }
  if (table === 'Users') {
    return createUser(data);
  }
  return null;
}

dbRoutes.post('/', async (c) => {
  const queryTable = c.req.query('table');
  if (queryTable && !TABLE_MAP[queryTable]) {
    return c.json({ errno: 1, errmsg: 'Invalid table' }, 400);
  }

  const body = await c.req.json();
  const bodyTable = body && typeof body.table === 'string' ? body.table : '';
  const table = queryTable || bodyTable;
  if (!table || !TABLE_MAP[table]) {
    return c.json({ errno: 1, errmsg: 'Invalid table' }, 400);
  }

  const allowedCols = ALLOWED_COLUMNS[table];

  // ---- Batch mode: { table, rows: [...] } ----
  if (body && 'rows' in body) {
    const rows = body.rows;
    if (!Array.isArray(rows)) {
      return c.json({ errno: 1, errmsg: 'Invalid rows' }, 400);
    }

    let count = 0;
    const errors: { index: number; message: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const created = await insertRow(table, allowedCols, rows[i], true);
        if (!created) throw new Error('Insert failed');
        count += 1;
      } catch (error) {
        // A single bad row must not abort the whole batch
        if (errors.length < 20) {
          errors.push({ index: i, message: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return c.json({ errno: 0, data: { count, failed: rows.length - count, errors } });
  }

  // ---- Single mode: unchanged behaviour and response shape ----
  let created: any;
  try {
    created = await insertRow(table, allowedCols, body, false);
  } catch (error) {
    const errmsg = error instanceof Error ? error.message : 'Insert failed';
    return c.json({ errno: 1, errmsg }, 400);
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
