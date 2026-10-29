#!/usr/bin/env node
/**
 * Offline comment + index rebuild for waline-oe.
 *
 * Why this exists: rebuilding indexes for ~15k comments needs far more KV
 * operations than one edge-function invocation can perform, so the in-admin
 * "rebuild" button times out and returns a platform error page. This script
 * runs the real index-building code locally (no time limit), against an
 * in-memory KV, and then pushes the resulting keys through
 * POST /api/db/raw-batch in small chunks.
 *
 * It is idempotent: every key is an overwrite, so a failed run can simply be
 * re-run.
 *
 * Usage:
 *   node scripts/offline-rebuild.mjs --data tmp/waline-export.json
 *   node scripts/offline-rebuild.mjs --data tmp/waline-export.json --apply --token <admin-jwt>
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const has = (name) => argv.includes('--' + name);

const DATA = arg('data', 'tmp/waline-export.json');
const BUILD = arg('build', '.tmp-build');
const BASE = arg('base', 'https://api.zhangge.net').replace(/\/+$/, '');
const TOKEN = arg('token', process.env.WALINE_TOKEN || '');
const BATCH = parseInt(arg('batch', '200'), 10);
const APPLY = has('apply');

// ---------------------------------------------------------------- mock KV
const store = new Map();
const pending = new Map();
const removed = new Set();

globalThis.WALINE_KV = {
  async get(key) {
    const v = store.get(key);
    return v === undefined ? null : v;
  },
  async put(key, value) {
    store.set(key, String(value));
    pending.set(key, String(value));
    removed.delete(key);
  },
  async delete(key) {
    store.delete(key);
    pending.delete(key);
    removed.add(key);
  },
  async list(opts = {}) {
    const prefix = opts.prefix || '';
    const limit = opts.limit || 1000;
    let keys = [...store.keys()].sort().filter((k) => k.startsWith(prefix));
    if (opts.cursor) {
      const idx = keys.indexOf(opts.cursor);
      keys = idx >= 0 ? keys.slice(idx + 1) : [];
    }
    const page = keys.slice(0, limit);
    const complete = keys.length <= limit;
    return {
      keys: page.map((name) => ({ name })),
      cursor: complete ? undefined : page[page.length - 1],
      list_complete: complete,
    };
  },
};

// ------------------------------------------------------------ load modules
const buildDir = path.resolve(process.cwd(), BUILD);
const { insertRow, ALLOWED_COLUMNS } = await import(pathToFileURL(path.join(buildDir, 'router/db.js')).href);
const { rebuildCommentIndexes } = await import(pathToFileURL(path.join(buildDir, 'db/kv-store.js')).href);

// -------------------------------------------------------------- load source
const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), DATA), 'utf8'));
const source = raw.data || raw;
const rows = source.Comment || [];
console.log('source comments:', rows.length);

// Exported JSON uses the literal string "None" for SQL NULL in numeric columns.
// insertRow only drops real null/undefined, so those would survive as the
// string "None" and make isRootComment() (rid === null && pid === null)
// classify every comment as a reply -- i.e. an empty list on every article.
const NUMERIC_FIELDS = ['user_id', 'pid', 'rid', 'sticky', 'like'];
const NULL_LITERALS = new Set(['None', 'none', 'NULL', 'null', '']);

function cleanRow(row) {
  const out = { ...row };
  for (const field of NUMERIC_FIELDS) {
    let v = out[field];
    if (typeof v === 'string') v = v.trim();
    if (v === undefined || NULL_LITERALS.has(v)) v = null;
    else if (typeof v === 'string' && /^-?\d+$/.test(v)) v = Number(v);
    out[field] = v === undefined ? null : v;
  }
  return out;
}

let imported = 0;
let skipped = 0;
for (const row of rows) {
  try {
    await insertRow('Comment', ALLOWED_COLUMNS.Comment, cleanRow(row), true, true);
    imported++;
  } catch (error) {
    skipped++;
    if (skipped <= 3) console.warn('skip row:', error?.message);
  }
}
console.log('imported into mock kv:', imported, 'skipped:', skipped);

// ------------------------------------------------------------ build indexes
const t0 = Date.now();
const result = await rebuildCommentIndexes();
console.log('rebuild result:', JSON.stringify(result));
console.log('index build took', ((Date.now() - t0) / 1000).toFixed(1) + 's');

const puts = [...pending.entries()].map(([key, value]) => ({ key, value }));
const deletes = [...removed];
const byPrefix = {};
for (const { key } of puts) {
  const p = key.split(':').slice(0, 2).join(':') + ':';
  byPrefix[p] = (byPrefix[p] || 0) + 1;
}
console.log('total puts:', puts.length, 'deletes:', deletes.length);
console.log('puts by prefix:');
for (const [p, n] of Object.entries(byPrefix).sort((a, b) => b[1] - a[1])) {
  console.log('  ', p, n);
}

// sanity: root comments must exist, otherwise every article renders empty
let roots = 0;
let replies = 0;
for (const [key, value] of pending.entries()) {
  if (!key.startsWith('comment:')) continue;
  try {
    const c = JSON.parse(value);
    if (c.rid === null && c.pid === null) roots++;
    else replies++;
  } catch {
    /* ignore */
  }
}
console.log('root comments:', roots, 'replies:', replies);

const sample = puts.filter((p) => p.key.startsWith('comments:url:'));
for (const s of sample.slice(0, 3)) console.log('sample', s.key, '=>', s.value.slice(0, 120));

if (!APPLY) {
  console.log('');
  console.log('[dry-run] 加 --apply --token <admin-jwt> 执行回写');
  process.exit(0);
}

if (!TOKEN) {
  console.error('缺少 --token（后台登录态 JWT，localStorage.TOKEN）');
  process.exit(1);
}

// ------------------------------------------------------------------- push
const endpoint = BASE + '/api/db/raw-batch?token=' + encodeURIComponent(TOKEN);
let done = 0;
let failed = 0;

async function push(items, del) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puts: items, deletes: del }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + text.slice(0, 200));
      const json = JSON.parse(text);
      if (json.errno) throw new Error(json.errmsg || 'errno ' + json.errno);
      return json.data;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

const totalBatches = Math.ceil(puts.length / BATCH);
let batchNo = 0;
for (let i = 0; i < puts.length; i += BATCH) {
  const chunk = puts.slice(i, i + BATCH);
  batchNo++;
  try {
    await push(chunk, []);
    done += chunk.length;
    if (batchNo % 20 === 0 || batchNo === totalBatches) {
      console.log('put progress', done + '/' + puts.length);
    }
  } catch (error) {
    failed += chunk.length;
    console.error('batch failed at', i, error.message);
  }
}

if (deletes.length) {
  for (let i = 0; i < deletes.length; i += BATCH) {
    const chunk = deletes.slice(i, i + BATCH);
    try {
      await push([], chunk);
    } catch (error) {
      console.error('delete batch failed at', i, error.message);
    }
  }
}

console.log('done:', done, 'failed:', failed);
