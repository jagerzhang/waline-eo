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
export const ALLOWED_COLUMNS: Record<string, Set<string>> = {
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
/**
 * POST /api/db/raw-batch - Direct KV batch write.
 *
 * Built for the offline index rebuild: the full rebuild of ~15k comments needs
 * far more KV operations than a single edge-function invocation allows, so the
 * computation runs locally and only the resulting key/value pairs are pushed
 * here in small chunks. Writes are restricted to comment + derived-index
 * prefixes, so credentials, settings and counters stay untouched.
 */
const RAW_WRITE_PREFIXES = [
  'comment:',
  'comments:',
  'count:comments:',
  'index:comments:',
  'meta:comments:',
];
const RAW_BATCH_MAX_ITEMS = 300;
const RAW_BATCH_CONCURRENCY = 25;

dbRoutes.post('/raw-batch', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ errno: 1, errmsg: 'Invalid body' }, 400);
  }

  const puts: { key: string; value: string }[] = Array.isArray(body.puts) ? body.puts : [];
  const deletes: string[] = Array.isArray(body.deletes) ? body.deletes : [];

  if (puts.length + deletes.length > RAW_BATCH_MAX_ITEMS) {
    return c.json({ errno: 1, errmsg: `Too many items in one batch (max ${RAW_BATCH_MAX_ITEMS})` }, 400);
  }

  const isAllowed = (key: unknown): key is string =>
    typeof key === 'string' && RAW_WRITE_PREFIXES.some((prefix) => key.startsWith(prefix));

  for (const item of puts) {
    if (!item || !isAllowed(item.key) || typeof item.value !== 'string') {
      return c.json({ errno: 1, errmsg: `Key not writable: ${item?.key}` }, 400);
    }
  }
  for (const key of deletes) {
    if (!isAllowed(key)) {
      return c.json({ errno: 1, errmsg: `Key not writable: ${key}` }, 400);
    }
  }

  const errors: string[] = [];
  let written = 0;
  let removed = 0;

  for (let i = 0; i < puts.length; i += RAW_BATCH_CONCURRENCY) {
    const chunk = puts.slice(i, i + RAW_BATCH_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (item) => {
      try {
        await WALINE_KV.put(item.key, item.value);
        return true;
      } catch (error) {
        errors.push(`put ${item.key}: ${(error as Error).message}`);
        return false;
      }
    }));
    written += results.filter(Boolean).length;
  }

  for (let i = 0; i < deletes.length; i += RAW_BATCH_CONCURRENCY) {
    const chunk = deletes.slice(i, i + RAW_BATCH_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (key) => {
      try {
        await WALINE_KV.delete(key);
        return true;
      } catch (error) {
        errors.push(`delete ${key}: ${(error as Error).message}`);
        return false;
      }
    }));
    removed += results.filter(Boolean).length;
  }

  return c.json({
    errno: errors.length ? 1 : 0,
    errmsg: errors.length ? errors.slice(0, 3).join('; ') : '',
    data: { written, removed, errors: errors.length },
  });
});

});

export async function importCommentWithoutIndexes(data: Record<string, any>): Promise<{ id: number }> {
  let id = data.id as number | undefined;
  if (id === undefined) {
    const current = await WALINE_KV.get('meta:next_comment_id');
    const base = current ? parseInt(String(current), 10) : 1;
    id = Math.max(base, Date.now() * 1000 + Math.floor(Math.random() * 1000));
    await WALINE_KV.put('meta:next_comment_id', String(id + 1));
  }

  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const now = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  const comment = {
    id,
    user_id: data.user_id ?? null,
    comment: data.comment || '',
    orig: data.orig || data.comment || '',
    insertedAt: data.insertedAt || now,
    ip: data.ip || '',
    link: data.link || '',
    mail: data.mail || '',
    nick: data.nick || '',
    pid: data.pid ?? null,
    rid: data.rid ?? null,
    sticky: data.sticky ?? 0,
    status: data.status || 'approved',
    like: data.like ?? 0,
    ua: data.ua || '',
    url: data.url || '',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };

  await WALINE_KV.put(`comment:${id}`, JSON.stringify(comment));
  return { id };
}

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
export async function insertRow(
  table: string,
  allowedCols: Set<string>,
  body: any,
  keepObjectId: boolean,
  batchCommentImport = false,
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
    return batchCommentImport ? importCommentWithoutIndexes(data) : createComment(data);
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
    let maxCommentId = 0;
    const errors: { index: number; message: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const created = await insertRow(table, allowedCols, rows[i], true, table === 'Comment');
        if (!created) throw new Error('Insert failed');
        count += 1;
        if (table === 'Comment') maxCommentId = Math.max(maxCommentId, created.id);
      } catch (error) {
        // A single bad row must not abort the whole batch
        if (errors.length < 20) {
          errors.push({ index: i, message: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    if (table === 'Comment' && maxCommentId > 0) {
      const currentRaw = await WALINE_KV.get('meta:next_comment_id');
      const currentId = currentRaw ? parseInt(String(currentRaw), 10) : 1;
      if (!Number.isFinite(currentId) || currentId <= maxCommentId) {
        await WALINE_KV.put('meta:next_comment_id', String(maxCommentId + 1));
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
