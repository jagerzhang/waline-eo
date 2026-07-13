/**
 * EdgeOne KV Database Layer
 * Replaces Cloudflare D1 with EdgeOne KV while preserving all Waline functionality.
 */
import { bumpCommentListVersion } from './comment-cache.js';
import { mapWithConcurrencyLimit } from '../utils/concurrency.js';

// ---------- Types ----------

export interface KVComment {
  id: number;
  user_id: number | null;
  comment: string;
  orig: string;
  insertedAt: string;
  ip: string;
  link: string;
  mail: string;
  nick: string;
  pid: number | null;
  rid: number | null;
  sticky: number;
  status: string;
  like: number;
  ua: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface KVUser {
  id: number;
  display_name: string;
  email: string;
  password: string;
  type: string;
  label: string;
  url: string;
  avatar: string;
  github: string;
  twitter: string;
  facebook: string;
  google: string;
  weibo: string;
  qq: string;
  '2fa': string;
  createdAt: string;
  updatedAt: string;
}

export interface KVCounter {
  id: number;
  time: number;
  reaction0: number;
  reaction1: number;
  reaction2: number;
  reaction3: number;
  reaction4: number;
  reaction5: number;
  reaction6: number;
  reaction7: number;
  reaction8: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Helpers ----------

function nowIso(): string {
  // Match D1 datetime('now') format: YYYY-MM-DD HH:MM:SS (UTC)
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

async function getJson<T>(key: string): Promise<T | null> {
  try {
    // EdgeOne Pages KV.get returns string | object | ArrayBuffer | ReadableStream.
    // Always fetch as raw string/object, then parse if needed.
    const raw = await WALINE_KV.get(key);
    if (!raw) return null;
    if (typeof raw === 'string') {
      return JSON.parse(raw) as T;
    }
    return raw as T;
  } catch {
    return null;
  }
}

async function putJson<T>(key: string, value: T): Promise<void> {
  await WALINE_KV.put(key, JSON.stringify(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function deleteKvKey(key: string): Promise<void> {
  if (!key) return;

  try {
    await WALINE_KV.delete(key);
  } catch (error) {
    // EdgeOne KV delete can fail on existing colon/slash keys. An empty value
    // is treated as missing by getJson/getRaw callers, so this preserves delete semantics.
    console.warn(`[Waline KV] delete failed for "${key}", falling back to empty value: ${errorMessage(error)}`);
    try {
      await WALINE_KV.put(key, '');
    } catch (fallbackError) {
      console.error(`[Waline KV] delete fallback failed for "${key}": ${errorMessage(fallbackError)}`);
      throw error;
    }
  }
}

async function cleanupKvKey(key: string): Promise<void> {
  try {
    await deleteKvKey(key);
  } catch (error) {
    console.warn(`[Waline KV] cleanup delete failed for "${key}": ${errorMessage(error)}`);
  }
}

async function ignoreCleanupError(label: string, action: Promise<unknown>): Promise<void> {
  try {
    await action;
  } catch (error) {
    console.warn(`[Waline KV] cleanup failed (${label}): ${errorMessage(error)}`);
  }
}

async function getIds(key: string): Promise<number[]> {
  const arr = await getJson<number[]>(key);
  return Array.isArray(arr) ? arr : [];
}

async function addId(key: string, id: number, prepend = false): Promise<void> {
  const ids = await getIds(key);
  if (!Array.isArray(ids)) return;
  if (ids.includes(id)) return;
  if (prepend) {
    ids.unshift(id);
  } else {
    ids.push(id);
  }
  await putJson(key, ids);
}

async function removeId(key: string, id: number): Promise<void> {
  const ids = await getIds(key);
  if (!Array.isArray(ids)) return;
  const filtered = ids.filter((x) => x !== id);
  if (filtered.length !== ids.length) {
    await putJson(key, filtered);
  }
}

function listKeyName(k: any): string {
  if (typeof k === 'string') return k;
  return k?.name || k?.key || '';
}

async function getNextId(metaKey: string): Promise<number> {
  // EdgeOne KV has no atomic increment, so combine the stored counter with a timestamp.
  const current = await WALINE_KV.get(metaKey);
  const base = current ? parseInt(current) : 1;
  const timeBasedId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const id = Math.max(base, timeBasedId);
  await WALINE_KV.put(metaKey, String(id + 1));
  return id;
}

// ---------- Comment Operations ----------
// 十万条负载优化方案：
// 1. 根评论按 URL 分页存储 ID（每页 50 条），避免大数组
// 2. 子评论按 rid 聚合存储完整对象数组（数量通常可控）
// 3. URL 评论计数独立维护，读取时无需遍历
// 4. 最近评论只维护 200 条索引
// 5. 状态索引分页存储（每页 100 条）

const ROOT_PAGE_SIZE = 50;
const STATUS_PAGE_SIZE = 100;
const RECENT_LIMIT = 200;
const USER_RECENT_LIMIT = 100;
const KV_LIST_LIMIT = 256;
const KV_READ_CONCURRENCY = 24;
const ROOT_STATUS_INDEX_VERSION = '2';
const SETTINGS_CACHE_TTL_MS = 30_000;
const COMMENT_STATUSES = ['approved', 'waiting', 'spam'];

const settingsCache = new Map<string, { value: string | null; expiresAt: number }>();

function countKeyStatus(status: string): string {
  return `meta:comments:status:${status}:count`;
}

function countKeyUserApproved(userId: number): string {
  return `count:comments:user:${userId}:approved`;
}

function normalizeMail(mail: string): string {
  return mail.trim().toLowerCase();
}

function countKeyMailApproved(mail: string): string {
  return `count:comments:mail:${encodeURIComponent(normalizeMail(mail))}:approved`;
}

async function getNumberKey(key: string): Promise<number | null> {
  const raw = await WALINE_KV.get(key);
  if (raw === null || raw === undefined || raw === '') return null;
  const value = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(value) ? value : null;
}

async function putNumberKey(key: string, value: number): Promise<void> {
  await WALINE_KV.put(key, String(Math.max(0, Math.floor(value))));
}

async function incNumberKeyIfInitialized(key: string, delta: number): Promise<void> {
  const current = await getNumberKey(key);
  if (current === null) return;
  await putNumberKey(key, current + delta);
}

function isRootComment(comment: KVComment): boolean {
  return !!comment.url && comment.rid === null && comment.pid === null;
}

function affectsPublicCommentList(comment: KVComment | null | undefined): boolean {
  return !!comment?.url && comment.status === 'approved';
}

async function bumpPublicCommentVersions(...comments: Array<KVComment | null | undefined>): Promise<void> {
  const urls = Array.from(new Set(
    comments
      .filter(affectsPublicCommentList)
      .map((comment) => comment!.url),
  ));
  await Promise.all(urls.map((url) => bumpCommentListVersion(url)));
}

// --- 根评论分页 ---

async function getRootPageIds(url: string, page: number): Promise<number[]> {
  const arr = await getJson<number[]>(`comments:url:${url}:root:ids:page:${page}`);
  return Array.isArray(arr) ? arr : [];
}

async function setRootPageIds(url: string, page: number, ids: number[]): Promise<void> {
  await putJson(`comments:url:${url}:root:ids:page:${page}`, ids);
}

async function getRootPages(url: string): Promise<number> {
  return (await getJson<number>(`meta:comments:url:${url}:root:pages`)) || 0;
}

async function setRootPages(url: string, pages: number): Promise<void> {
  await putJson(`meta:comments:url:${url}:root:pages`, pages);
}

async function getRootCount(url: string): Promise<number> {
  return (await getJson<number>(`meta:comments:url:${url}:root:count`)) || 0;
}

async function setRootCount(url: string, count: number): Promise<void> {
  await putJson(`meta:comments:url:${url}:root:count`, count);
}

// 插入到 page:0 开头，溢出时级联到后续页
async function addRootCommentId(url: string, id: number, dedupe = true): Promise<void> {
  // Idempotent insert: stale duplicate IDs in this index make the public
  // Waline list render the same comment more than once.
  if (dedupe) {
    await removeRootCommentId(url, id);
  }

  const pages = await getRootPages(url);
  let page0 = await getRootPageIds(url, 0);
  page0.unshift(id);

  if (page0.length > ROOT_PAGE_SIZE) {
    const overflow = page0.splice(ROOT_PAGE_SIZE);
    await setRootPageIds(url, 0, page0);

    let currentPage = 1;
    let remaining = overflow;
    while (remaining.length > 0) {
      const pageIds = await getRootPageIds(url, currentPage);
      pageIds.unshift(...remaining);
      if (pageIds.length > ROOT_PAGE_SIZE) {
        remaining = pageIds.splice(ROOT_PAGE_SIZE);
        await setRootPageIds(url, currentPage, pageIds);
        currentPage++;
      } else {
        await setRootPageIds(url, currentPage, pageIds);
        remaining = [];
      }
    }

    await setRootPages(url, Math.max(pages, currentPage + (remaining.length > 0 ? 1 : 0)));
  } else {
    await setRootPageIds(url, 0, page0);
    if (pages === 0) await setRootPages(url, 1);
  }

  await setRootCount(url, await getRootCount(url) + 1);
}

async function removeRootCommentId(url: string, id: number): Promise<void> {
  const pages = await getRootPages(url);
  let removed = 0;

  for (let page = 0; page < pages; page++) {
    const ids = await getRootPageIds(url, page);
    const filtered = ids.filter((cid) => cid !== id);
    const removedHere = ids.length - filtered.length;

    if (removedHere > 0) {
      removed += removedHere;
      await setRootPageIds(url, page, filtered);
    }
  }

  if (removed > 0) {
    await setRootCount(url, Math.max(0, await getRootCount(url) - removed));
  }
}

// --- URL + status root comment index ---

function rootStatusPageKey(url: string, status: string, page: number): string {
  return `comments:url:${url}:root:status:${status}:ids:page:${page}`;
}

function rootStatusPagesKey(url: string, status: string): string {
  return `meta:comments:url:${url}:root:status:${status}:pages`;
}

function rootStatusCountKey(url: string, status: string): string {
  return `meta:comments:url:${url}:root:status:${status}:count`;
}

function rootStatusIndexedKey(url: string, status: string): string {
  return `meta:comments:url:${url}:root:status:${status}:indexed`;
}

function rootStatusStickyKey(url: string, status: string): string {
  return `comments:url:${url}:root:status:${status}:sticky`;
}

async function getRootStatusPageIds(url: string, status: string, page: number): Promise<number[]> {
  const arr = await getJson<number[]>(rootStatusPageKey(url, status, page));
  return Array.isArray(arr) ? arr : [];
}

async function setRootStatusPageIds(url: string, status: string, page: number, ids: number[]): Promise<void> {
  await putJson(rootStatusPageKey(url, status, page), ids);
}

async function getRootStatusPages(url: string, status: string): Promise<number> {
  return (await getJson<number>(rootStatusPagesKey(url, status))) || 0;
}

async function setRootStatusPages(url: string, status: string, pages: number): Promise<void> {
  await putJson(rootStatusPagesKey(url, status), pages);
}

async function getRootStatusStickyIds(url: string, status: string): Promise<number[]> {
  const ids = await getJson<number[]>(rootStatusStickyKey(url, status));
  return Array.isArray(ids) ? ids : [];
}

async function setRootStatusStickyIds(url: string, status: string, ids: number[]): Promise<void> {
  await putJson(rootStatusStickyKey(url, status), Array.from(new Set(ids)));
}

async function isRootStatusIndexReady(url: string, status: string): Promise<boolean> {
  return await WALINE_KV.get(rootStatusIndexedKey(url, status)) === ROOT_STATUS_INDEX_VERSION;
}

async function rebuildRootStatusIndex(url: string, status: string): Promise<void> {
  const oldPages = await getRootStatusPages(url, status);
  const comments = (await getAllRootCommentsByUrl(url))
    .filter((c) => c.status === status)
    .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));

  const pages = Math.ceil(comments.length / ROOT_PAGE_SIZE);
  for (let page = 0; page < pages; page++) {
    const ids = comments
      .slice(page * ROOT_PAGE_SIZE, (page + 1) * ROOT_PAGE_SIZE)
      .map((c) => c.id);
    await setRootStatusPageIds(url, status, page, ids);
  }
  for (let page = pages; page < oldPages; page++) {
    await cleanupKvKey(rootStatusPageKey(url, status, page));
  }

  const stickyIds = comments
    .filter((c) => c.sticky)
    .map((c) => c.id);

  await Promise.all([
    setRootStatusPages(url, status, pages),
    putNumberKey(rootStatusCountKey(url, status), comments.length),
    setRootStatusStickyIds(url, status, stickyIds),
    WALINE_KV.put(rootStatusIndexedKey(url, status), ROOT_STATUS_INDEX_VERSION),
  ]);
}

async function ensureRootStatusIndex(url: string, status: string, allowRebuild = true): Promise<boolean> {
  if (await isRootStatusIndexReady(url, status)) return true;
  if (!allowRebuild) return false;
  await rebuildRootStatusIndex(url, status);
  return true;
}

async function addRootStatusCommentId(comment: KVComment, dedupe = true): Promise<void> {
  if (!isRootComment(comment)) return;
  const { url, status, id } = comment;
  if (!(await isRootStatusIndexReady(url, status))) return;

  if (dedupe) {
    await removeRootStatusCommentId(url, status, id);
  }

  const pages = await getRootStatusPages(url, status);
  const page0 = await getRootStatusPageIds(url, status, 0);
  page0.unshift(id);

  if (page0.length > ROOT_PAGE_SIZE) {
    const overflow = page0.splice(ROOT_PAGE_SIZE);
    await setRootStatusPageIds(url, status, 0, page0);

    let currentPage = 1;
    let remaining = overflow;
    while (remaining.length > 0) {
      const pageIds = await getRootStatusPageIds(url, status, currentPage);
      pageIds.unshift(...remaining);
      if (pageIds.length > ROOT_PAGE_SIZE) {
        remaining = pageIds.splice(ROOT_PAGE_SIZE);
        await setRootStatusPageIds(url, status, currentPage, pageIds);
        currentPage++;
      } else {
        await setRootStatusPageIds(url, status, currentPage, pageIds);
        remaining = [];
      }
    }

    await setRootStatusPages(url, status, Math.max(pages, currentPage + (remaining.length > 0 ? 1 : 0)));
  } else {
    await setRootStatusPageIds(url, status, 0, page0);
    if (pages === 0) await setRootStatusPages(url, status, 1);
  }

  await incNumberKeyIfInitialized(rootStatusCountKey(url, status), 1);
  if (comment.sticky) {
    const stickyIds = await getRootStatusStickyIds(url, status);
    if (!stickyIds.includes(id)) {
      stickyIds.unshift(id);
      await setRootStatusStickyIds(url, status, stickyIds);
    }
  }
}

async function removeRootStatusCommentId(url: string, status: string, id: number): Promise<void> {
  if (!(await isRootStatusIndexReady(url, status))) return;

  const pages = await getRootStatusPages(url, status);
  let removed = 0;

  for (let page = 0; page < pages; page++) {
    const ids = await getRootStatusPageIds(url, status, page);
    const filtered = ids.filter((cid) => cid !== id);
    const removedHere = ids.length - filtered.length;
    if (removedHere > 0) {
      removed += removedHere;
      await setRootStatusPageIds(url, status, page, filtered);
    }
  }

  if (removed > 0) {
    await incNumberKeyIfInitialized(rootStatusCountKey(url, status), -removed);
    const stickyIds = await getRootStatusStickyIds(url, status);
    const filteredSticky = stickyIds.filter((cid) => cid !== id);
    if (filteredSticky.length !== stickyIds.length) {
      await setRootStatusStickyIds(url, status, filteredSticky);
    }
  }
}

async function updateRootStatusSticky(comment: KVComment): Promise<void> {
  if (!isRootComment(comment)) return;
  if (!(await isRootStatusIndexReady(comment.url, comment.status))) return;

  const stickyIds = await getRootStatusStickyIds(comment.url, comment.status);
  const withoutCurrent = stickyIds.filter((id) => id !== comment.id);
  if (comment.sticky) {
    withoutCurrent.unshift(comment.id);
  }
  await setRootStatusStickyIds(comment.url, comment.status, withoutCurrent);
}

// --- 子评论聚合 ---

function childCommentsKey(rid: number): string {
  return `comments:rid:${rid}`;
}

function childStatusCommentsKey(rid: number, status: string): string {
  return `comments:rid:${rid}:status:${status}`;
}

async function getLegacyChildComments(rid: number): Promise<KVComment[]> {
  const arr = await getJson<KVComment[]>(childCommentsKey(rid));
  return Array.isArray(arr) ? arr : [];
}

async function getChildComments(rid: number, status?: string): Promise<KVComment[]> {
  if (status) {
    const statusArr = await getJson<KVComment[]>(childStatusCommentsKey(rid, status));
    if (Array.isArray(statusArr)) return statusArr;

    const legacy = await getLegacyChildComments(rid);
    return legacy.filter((c) => c.status === status);
  }

  const statusResults = await Promise.all(
    COMMENT_STATUSES.map((s) => getJson<KVComment[]>(childStatusCommentsKey(rid, s))),
  );
  const collected = statusResults
    .filter((arr): arr is KVComment[] => Array.isArray(arr))
    .flat();

  if (collected.length > 0) {
    return uniqueCommentsById(collected);
  }

  return getLegacyChildComments(rid);
}

async function setChildStatusComments(rid: number, status: string, comments: KVComment[]): Promise<void> {
  await putJson(childStatusCommentsKey(rid, status), comments);
}

async function addChildComment(comment: KVComment): Promise<void> {
  if (comment.rid === null) return;
  const children = (await getChildComments(comment.rid, comment.status))
    .filter((c) => c.id !== comment.id);
  children.push(comment);
  children.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  await setChildStatusComments(comment.rid, comment.status, children);
}

async function replaceChildComment(comment: KVComment): Promise<void> {
  if (comment.rid === null) return;
  const children = await getChildComments(comment.rid, comment.status);
  const index = children.findIndex((c) => c.id === comment.id);
  if (index === -1) {
    children.push(comment);
  } else {
    children[index] = comment;
  }
  children.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  await setChildStatusComments(comment.rid, comment.status, children);
}

async function removeChildComment(rid: number, id: number, status?: string): Promise<void> {
  const statuses = status ? [status] : COMMENT_STATUSES;
  await Promise.all(
    statuses.map(async (s) => {
      const children = await getChildComments(rid, s);
      const filtered = children.filter((c) => c.id !== id);
      if (filtered.length !== children.length) {
        await setChildStatusComments(rid, s, filtered);
      }
    }),
  );

  const legacy = await getLegacyChildComments(rid);
  if (legacy.length > 0) {
    const filteredLegacy = legacy.filter((c) => c.id !== id);
    if (filteredLegacy.length !== legacy.length) {
      await putJson(childCommentsKey(rid), filteredLegacy);
    }
  }
}

async function clearChildCommentIndexes(rid: number): Promise<void> {
  await Promise.all([
    cleanupKvKey(childCommentsKey(rid)),
    ...COMMENT_STATUSES.map((status) => cleanupKvKey(childStatusCommentsKey(rid, status))),
  ]);
}

// --- 评论计数 ---

async function getCommentCount(url: string): Promise<number> {
  const val = await WALINE_KV.get(`count:comments:url:${url}`);
  return val ? parseInt(val) : 0;
}

async function incCommentCount(url: string, delta: number): Promise<void> {
  if (!url) return;
  const current = await getCommentCount(url);
  await WALINE_KV.put(`count:comments:url:${url}`, String(Math.max(0, current + delta)));
}

// --- 最近评论索引 ---

async function addRecentCommentId(id: number): Promise<void> {
  const raw = await getJson<number[]>('index:comments:recent');
  const recent = Array.isArray(raw) ? raw : [];
  recent.unshift(id);
  if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  await putJson('index:comments:recent', recent);
}

async function removeRecentCommentId(id: number): Promise<void> {
  const raw = await getJson<number[]>('index:comments:recent');
  const recent = Array.isArray(raw) ? raw : [];
  const filtered = recent.filter((cid) => cid !== id);
  if (filtered.length !== recent.length) {
    await putJson('index:comments:recent', filtered);
  }
}

// --- 状态索引分页 ---

async function getStatusPageIds(status: string, page: number): Promise<number[]> {
  const arr = await getJson<number[]>(`index:comments:status:${status}:ids:page:${page}`);
  return Array.isArray(arr) ? arr : [];
}

async function setStatusPageIds(status: string, page: number, ids: number[]): Promise<void> {
  await putJson(`index:comments:status:${status}:ids:page:${page}`, ids);
}

async function getStatusPages(status: string): Promise<number> {
  return (await getJson<number>(`meta:comments:status:${status}:pages`)) || 0;
}

export async function getStatusCommentCount(status: string): Promise<number> {
  const cached = await getNumberKey(countKeyStatus(status));
  if (cached !== null) return cached;

  const pages = await getStatusPages(status);
  if (pages === 0) {
    await putNumberKey(countKeyStatus(status), 0);
    return 0;
  }
  const allIds: number[] = [];
  for (let page = 0; page < pages; page++) {
    const ids = await getStatusPageIds(status, page);
    allIds.push(...ids);
  }
  const comments = await getCommentsByIds(allIds);
  const count = comments.filter((c) => c.status === status).length;
  await putNumberKey(countKeyStatus(status), count);
  return count;
}

async function setStatusPages(status: string, pages: number): Promise<void> {
  await putJson(`meta:comments:status:${status}:pages`, pages);
}

async function addStatusCommentId(status: string, id: number, dedupe = true): Promise<void> {
  if (dedupe) {
    await removeStatusCommentId(status, id);
  }

  const pages = await getStatusPages(status);
  let page0 = await getStatusPageIds(status, 0);
  page0.unshift(id);

  if (page0.length > STATUS_PAGE_SIZE) {
    const overflow = page0.splice(STATUS_PAGE_SIZE);
    await setStatusPageIds(status, 0, page0);

    let currentPage = 1;
    let remaining = overflow;
    while (remaining.length > 0) {
      const pageIds = await getStatusPageIds(status, currentPage);
      pageIds.unshift(...remaining);
      if (pageIds.length > STATUS_PAGE_SIZE) {
        remaining = pageIds.splice(STATUS_PAGE_SIZE);
        await setStatusPageIds(status, currentPage, pageIds);
        currentPage++;
      } else {
        await setStatusPageIds(status, currentPage, pageIds);
        remaining = [];
      }
    }

    await setStatusPages(status, Math.max(pages, currentPage + (remaining.length > 0 ? 1 : 0)));
  } else {
    await setStatusPageIds(status, 0, page0);
    if (pages === 0) await setStatusPages(status, 1);
  }

  await incNumberKeyIfInitialized(countKeyStatus(status), 1);
}

async function removeStatusCommentId(status: string, id: number): Promise<void> {
  const pages = await getStatusPages(status);
  let removed = 0;
  for (let page = 0; page < pages; page++) {
    const ids = await getStatusPageIds(status, page);
    const filtered = ids.filter((cid) => cid !== id);
    if (filtered.length !== ids.length) {
      removed += ids.length - filtered.length;
      await setStatusPageIds(status, page, filtered);
    }
  }
  if (removed > 0) {
    await incNumberKeyIfInitialized(countKeyStatus(status), -removed);
  }
}

// --- 用户评论索引（最近 100 条）---

async function addUserCommentId(userId: number, id: number): Promise<void> {
  const key = `index:comments:user:${userId}:recent`;
  const raw = await getJson<number[]>(key);
  const recent = Array.isArray(raw) ? raw : [];
  recent.unshift(id);
  if (recent.length > USER_RECENT_LIMIT) recent.length = USER_RECENT_LIMIT;
  await putJson(key, recent);
}

async function removeUserCommentId(userId: number, id: number): Promise<void> {
  const key = `index:comments:user:${userId}:recent`;
  const raw = await getJson<number[]>(key);
  const recent = Array.isArray(raw) ? raw : [];
  const filtered = recent.filter((cid) => cid !== id);
  if (filtered.length !== recent.length) {
    await putJson(key, filtered);
  }
}

// --- 核心 API ---

export async function getUserCommentCount(userId: number): Promise<number> {
  const counts = await getUserCommentCounts([userId]);
  return counts.get(userId) || 0;
}

export async function getMailCommentCount(mail: string): Promise<number> {
  const counts = await getMailCommentCounts([mail]);
  return counts.get(normalizeMail(mail)) || 0;
}

async function getApprovedCommentsForCounting(): Promise<KVComment[]> {
  const pages = await getStatusPages('approved');
  const pageIdsArrays = await Promise.all(
    Array.from({ length: pages }, (_, page) => getStatusPageIds('approved', page)),
  );
  const allIds = pageIdsArrays.flat();
  return (await getCommentsByIds(allIds)).filter((c) => c.status === 'approved');
}

export async function getUserCommentCounts(userIds: number[]): Promise<Map<number, number>> {
  const normalizedIds = Array.from(new Set(
    userIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  ));
  const result = new Map<number, number>();
  if (normalizedIds.length === 0) return result;

  const missing: number[] = [];
  await Promise.all(
    normalizedIds.map(async (id) => {
      const cached = await getNumberKey(countKeyUserApproved(id));
      if (cached === null) {
        missing.push(id);
      } else {
        result.set(id, cached);
      }
    }),
  );

  if (missing.length > 0) {
    const missingSet = new Set(missing);
    for (const id of missing) result.set(id, 0);
    const comments = await getApprovedCommentsForCounting();
    for (const comment of comments) {
      const userId = comment.user_id;
      if (userId !== null && missingSet.has(userId)) {
        result.set(userId, (result.get(userId) || 0) + 1);
      }
    }
    await Promise.all(missing.map((id) => putNumberKey(countKeyUserApproved(id), result.get(id) || 0)));
  }

  return result;
}

export async function getMailCommentCounts(mails: string[]): Promise<Map<string, number>> {
  const normalizedMails = Array.from(new Set(
    mails
      .map((mail) => normalizeMail(mail || ''))
      .filter(Boolean),
  ));
  const result = new Map<string, number>();
  if (normalizedMails.length === 0) return result;

  const missing: string[] = [];
  await Promise.all(
    normalizedMails.map(async (mail) => {
      const cached = await getNumberKey(countKeyMailApproved(mail));
      if (cached === null) {
        missing.push(mail);
      } else {
        result.set(mail, cached);
      }
    }),
  );

  if (missing.length > 0) {
    const missingSet = new Set(missing);
    for (const mail of missing) result.set(mail, 0);
    const comments = await getApprovedCommentsForCounting();
    for (const comment of comments) {
      const mail = normalizeMail(comment.mail || '');
      if (mail && missingSet.has(mail)) {
        result.set(mail, (result.get(mail) || 0) + 1);
      }
    }
    await Promise.all(missing.map((mail) => putNumberKey(countKeyMailApproved(mail), result.get(mail) || 0)));
  }

  return result;
}

async function updateApprovedAuthorCounts(comment: KVComment, delta: number): Promise<void> {
  if (comment.status !== 'approved') return;
  const ops: Promise<void>[] = [];
  if (comment.user_id !== null) {
    ops.push(incNumberKeyIfInitialized(countKeyUserApproved(comment.user_id), delta));
  }
  const mail = normalizeMail(comment.mail || '');
  if (mail) {
    ops.push(incNumberKeyIfInitialized(countKeyMailApproved(mail), delta));
  }
  await Promise.all(ops);
}

export async function createComment(data: Partial<KVComment>): Promise<KVComment> {
  const id = await getNextId('meta:next_comment_id');
  const now = nowIso();
  const comment: KVComment = {
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

  await putJson(`comment:${id}`, comment);

  const ops: Promise<void>[] = [
    addRecentCommentId(id),
    addStatusCommentId(comment.status, id, false),
  ];

  if (comment.url && comment.rid === null && comment.pid === null) {
    ops.push(addRootCommentId(comment.url, id, false));
    ops.push(addRootStatusCommentId(comment, false));
    ops.push(incCommentCount(comment.url, 1));
  }

  if (comment.rid !== null) {
    ops.push(addChildComment(comment));
  }

  if (comment.user_id !== null) {
    ops.push(addUserCommentId(comment.user_id, id));
  }

  ops.push(updateApprovedAuthorCounts(comment, 1));

  await Promise.all(ops);
  await bumpPublicCommentVersions(comment);

  return comment;
}

export async function getCommentById(id: number): Promise<KVComment | null> {
  return getJson<KVComment>(`comment:${id}`);
}

export async function updateComment(id: number, data: Partial<KVComment>): Promise<KVComment | null> {
  const comment = await getCommentById(id);
  if (!comment) return null;

  const oldUrl = comment.url;
  const oldStatus = comment.status;
  const oldRid = comment.rid;
  const oldPid = comment.pid;
  const oldUserId = comment.user_id;
  const oldMail = comment.mail;
  const oldSticky = comment.sticky;
  const oldCommentForCounts: KVComment = { ...comment };

  Object.assign(comment, data);
  comment.updatedAt = nowIso();
  await putJson(`comment:${id}`, comment);

  const urlChanged = data.url !== undefined && data.url !== oldUrl;
  const statusChanged = data.status !== undefined && data.status !== oldStatus;
  const ridChanged = data.rid !== undefined && data.rid !== oldRid;
  const pidChanged = data.pid !== undefined && data.pid !== oldPid;
  const userChanged = data.user_id !== undefined && data.user_id !== oldUserId;
  const mailChanged = data.mail !== undefined && data.mail !== oldMail;
  const stickyChanged = data.sticky !== undefined && data.sticky !== oldSticky;

  if (urlChanged || statusChanged || ridChanged || pidChanged) {
    const removeOps: Promise<void>[] = [
      removeStatusCommentId(oldStatus, id),
      removeRecentCommentId(id),
    ];

    if (oldUrl && oldRid === null && oldPid === null) {
      removeOps.push(removeRootCommentId(oldUrl, id));
      removeOps.push(removeRootStatusCommentId(oldUrl, oldStatus, id));
      removeOps.push(incCommentCount(oldUrl, -1));
    }

    if (oldRid !== null) {
      removeOps.push(removeChildComment(oldRid, id, oldStatus));
    }

    if (oldUserId !== null) {
      removeOps.push(removeUserCommentId(oldUserId, id));
    }

    await Promise.all(removeOps);

    const addOps: Promise<void>[] = [
      addStatusCommentId(comment.status, id),
      addRecentCommentId(id),
    ];

    if (comment.url && comment.rid === null && comment.pid === null) {
      addOps.push(addRootCommentId(comment.url, id));
      addOps.push(addRootStatusCommentId(comment));
      addOps.push(incCommentCount(comment.url, 1));
    }

    if (comment.rid !== null) {
      addOps.push(addChildComment(comment));
    }

    if (comment.user_id !== null) {
      addOps.push(addUserCommentId(comment.user_id, id));
    }

    await Promise.all(addOps);
  } else if (userChanged) {
    if (oldUserId !== null) await removeUserCommentId(oldUserId, id);
    if (comment.user_id !== null) await addUserCommentId(comment.user_id, id);
  }

  if (comment.rid !== null && !(urlChanged || statusChanged || ridChanged || pidChanged)) {
    await replaceChildComment(comment);
  }

  if (stickyChanged && !(urlChanged || statusChanged || ridChanged || pidChanged)) {
    await updateRootStatusSticky(comment);
  }

  if (statusChanged || userChanged || mailChanged) {
    await Promise.all([
      updateApprovedAuthorCounts(oldCommentForCounts, -1),
      updateApprovedAuthorCounts(comment, 1),
    ]);
  }

  await bumpPublicCommentVersions(oldCommentForCounts, comment);

  return comment;
}

export async function deleteCommentById(id: number): Promise<void> {
  const comment = await getCommentById(id);
  if (!comment) return;

  await deleteKvKey(`comment:${id}`);

  const ops: Array<[string, Promise<unknown>]> = [
    [`status:${comment.status}`, removeStatusCommentId(comment.status, id)],
    ['recent', removeRecentCommentId(id)],
  ];

  if (comment.url && comment.rid === null && comment.pid === null) {
    ops.push(['root', removeRootCommentId(comment.url, id)]);
    ops.push(['root-status', removeRootStatusCommentId(comment.url, comment.status, id)]);
    ops.push(['count', incCommentCount(comment.url, -1)]);
  }

  if (comment.rid !== null) {
    ops.push(['child', removeChildComment(comment.rid, id, comment.status)]);
  }

  if (comment.user_id !== null) {
    ops.push(['user', removeUserCommentId(comment.user_id, id)]);
  }

  ops.push(['author-count', updateApprovedAuthorCounts(comment, -1)]);

  await Promise.all(ops.map(([label, op]) => ignoreCleanupError(`${label}:${id}`, op)));
  await bumpPublicCommentVersions(comment);
}

export async function deleteCommentsByRid(rid: number): Promise<void> {
  const children = await getChildComments(rid);
  await Promise.all(children.map((c) => deleteCommentById(c.id)));
  if (children.length > 0) {
    await clearChildCommentIndexes(rid);
  }
}

export async function getCommentsByIds(ids: number[]): Promise<KVComment[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))));
  const comments = await mapWithConcurrencyLimit(uniqueIds, KV_READ_CONCURRENCY, (id) => getCommentById(id));
  return comments.filter((c): c is KVComment => c !== null);
}

function uniqueCommentsById(comments: KVComment[]): KVComment[] {
  const seen = new Set<number>();
  const unique: KVComment[] = [];

  for (const comment of comments) {
    if (seen.has(comment.id)) continue;
    seen.add(comment.id);
    unique.push(comment);
  }

  return unique;
}

async function getAllRootCommentsByUrl(url: string): Promise<KVComment[]> {
  const pages = await getRootPages(url);
  const allComments: KVComment[] = [];

  for (let page = 0; page < pages; page++) {
    const ids = await getRootPageIds(url, page);
    const comments = await Promise.all(ids.map((id) => getCommentById(id)));
    allComments.push(...comments.filter((c): c is KVComment => c !== null));
  }

  return uniqueCommentsById(allComments);
}

async function getRootStatusCount(url: string, status: string, allowRebuild = true): Promise<number> {
  const ready = await ensureRootStatusIndex(url, status, allowRebuild);
  if (!ready) {
    const comments = await getAllRootCommentsByUrl(url);
    return comments.filter((c) => c.status === status).length;
  }
  const cached = await getNumberKey(rootStatusCountKey(url, status));
  return cached || 0;
}

async function getAllRootStatusCommentsByUrl(url: string, status: string): Promise<KVComment[]> {
  await ensureRootStatusIndex(url, status);
  const pages = await getRootStatusPages(url, status);
  const allIds: number[] = [];
  for (let page = 0; page < pages; page++) {
    allIds.push(...await getRootStatusPageIds(url, status, page));
  }
  const comments = await getCommentsByIds(allIds);
  return comments.filter((c) => isRootComment(c) && c.url === url && c.status === status);
}

async function getRootStatusCommentsDesc(
  url: string,
  status: string,
  limit: number,
  offset: number,
  allowRebuild = true,
): Promise<{ comments: KVComment[]; total: number }> {
  const ready = await ensureRootStatusIndex(url, status, allowRebuild);
  if (!ready) {
    return getRootStatusCommentsDescFallback(url, status, limit, offset);
  }
  const total = await getRootStatusCount(url, status, allowRebuild);
  if (total === 0 || limit <= 0 || offset >= total) return { comments: [], total };

  const stickyIds = await getRootStatusStickyIds(url, status);
  const stickyComments = stickyIds.length > 0
    ? (await getCommentsByIds(stickyIds))
      .filter((c) => isRootComment(c) && c.url === url && c.status === status && !!c.sticky)
      .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt))
    : [];
  const stickySet = new Set(stickyComments.map((c) => c.id));
  const resultIds: number[] = [];

  if (offset < stickyComments.length) {
    resultIds.push(...stickyComments.slice(offset, offset + limit).map((c) => c.id));
  }

  let needed = limit - resultIds.length;
  if (needed > 0) {
    const normalOffset = Math.max(0, offset - stickyComments.length);
    const pages = await getRootStatusPages(url, status);
    let skipped = 0;

    for (let page = 0; page < pages && needed > 0; page++) {
      const ids = await getRootStatusPageIds(url, status, page);
      for (const id of ids) {
        if (stickySet.has(id)) continue;
        if (skipped < normalOffset) {
          skipped++;
          continue;
        }
        resultIds.push(id);
        needed--;
        if (needed === 0) break;
      }
    }
  }

  const commentsById = new Map(
    (await getCommentsByIds(resultIds))
      .filter((c) => isRootComment(c) && c.url === url && c.status === status)
      .map((c) => [c.id, c]),
  );
  return {
    comments: resultIds.map((id) => commentsById.get(id)).filter((c): c is KVComment => !!c),
    total,
  };
}

async function getRootStatusCommentsDescFallback(
  url: string,
  status: string,
  limit: number,
  offset: number,
): Promise<{ comments: KVComment[]; total: number }> {
  const filtered = (await getAllRootCommentsByUrl(url))
    .filter((c) => c.status === status)
    .sort((a, b) => {
      if (b.sticky !== a.sticky) return b.sticky - a.sticky;
      return b.insertedAt.localeCompare(a.insertedAt);
    });

  const total = filtered.length;
  return { comments: filtered.slice(offset, offset + limit), total };
}

export async function getRootCommentsByUrl(
  url: string,
  options: { orderBy: string; limit: number; offset: number; status?: string; allowIndexRebuild?: boolean },
): Promise<{ comments: KVComment[]; total: number }> {
  const pages = await getRootPages(url);
  if (pages === 0) return { comments: [], total: 0 };

  if (options.status && options.orderBy === 'insertedAt DESC') {
    return getRootStatusCommentsDesc(
      url,
      options.status,
      options.limit,
      options.offset,
      options.allowIndexRebuild !== false,
    );
  }

  let filtered = options.status
    ? await getAllRootStatusCommentsByUrl(url, options.status)
    : await getAllRootCommentsByUrl(url);

  if (options.orderBy === 'insertedAt ASC') {
    filtered.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  } else if (options.orderBy === 'like DESC') {
    filtered.sort((a, b) => b.like - a.like);
  } else {
    filtered.sort((a, b) => {
      if (b.sticky !== a.sticky) return b.sticky - a.sticky;
      return b.insertedAt.localeCompare(a.insertedAt);
    });
  }

  const total = filtered.length;
  return { comments: filtered.slice(options.offset, options.offset + options.limit), total };
}

export async function getChildCommentsByRids(rids: number[], status?: string): Promise<KVComment[]> {
  const results = await mapWithConcurrencyLimit(
    rids,
    KV_READ_CONCURRENCY,
    (rid) => getChildComments(rid, status),
  );
  let result = results.flat();
  result.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  return result;
}

export async function getRecentComments(limit: number): Promise<KVComment[]> {
  const raw = await getJson<number[]>('index:comments:recent');
  const ids = Array.isArray(raw) ? raw : [];
  const comments = await getCommentsByIds(ids.slice(0, Math.min(ids.length, limit * 2)));
  const approved = comments.filter((c) => c.status === 'approved');
  approved.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  return approved.slice(0, limit);
}

export async function getCommentCountByUrl(url: string, _status = 'approved'): Promise<number> {
  return getRootStatusCount(url, _status);
}

export async function getCommentCountsByUrls(urls: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  await Promise.all(
    urls.map(async (url) => {
      map[url] = await getCommentCountByUrl(url);
    }),
  );
  return map;
}

async function getStatusCommentsPage(
  status: string,
  limit: number,
  offset: number,
): Promise<{ data: KVComment[]; total: number }> {
  const total = await getStatusCommentCount(status);
  if (total === 0 || limit <= 0 || offset >= total) return { data: [], total };

  const pages = await getStatusPages(status);
  const ids: number[] = [];
  let skipped = 0;

  for (let page = 0; page < pages && ids.length < limit; page++) {
    const pageIds = await getStatusPageIds(status, page);
    for (const id of pageIds) {
      if (skipped < offset) {
        skipped++;
        continue;
      }
      ids.push(id);
      if (ids.length === limit) break;
    }
  }

  const commentsById = new Map(
    (await getCommentsByIds(ids))
      .filter((c) => c.status === status)
      .map((c) => [c.id, c]),
  );
  return {
    data: ids.map((id) => commentsById.get(id)).filter((c): c is KVComment => !!c),
    total,
  };
}

async function getStatusIdsWindow(status: string, limit: number): Promise<number[]> {
  if (limit <= 0) return [];
  const pages = await getStatusPages(status);
  const ids: number[] = [];

  for (let page = 0; page < pages && ids.length < limit; page++) {
    const pageIds = await getStatusPageIds(status, page);
    ids.push(...pageIds.slice(0, limit - ids.length));
  }

  return ids;
}

async function getCommentsPageAcrossStatuses(
  statuses: string[],
  limit: number,
  offset: number,
): Promise<{ data: KVComment[]; total: number }> {
  const counts = await Promise.all(statuses.map((status) => getStatusCommentCount(status)));
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0 || limit <= 0 || offset >= total) return { data: [], total };

  const windowSize = offset + limit;
  const ids = (await Promise.all(statuses.map((status) => getStatusIdsWindow(status, windowSize)))).flat();
  const statusSet = new Set(statuses);
  const comments = (await getCommentsByIds(ids))
    .filter((c) => statusSet.has(c.status))
    .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));

  return { data: comments.slice(offset, offset + limit), total };
}

async function getAllStatusComments(status: string): Promise<KVComment[]> {
  const pages = await getStatusPages(status);
  const pageIdsArrays = await Promise.all(
    Array.from({ length: pages }, (_, page) => getStatusPageIds(status, page)),
  );
  const allIds = pageIdsArrays.flat();
  return (await getCommentsByIds(allIds)).filter((c) => c.status === status);
}

export async function searchComments(
  options: {
    status?: string;
    keyword?: string;
    ownerEmail?: string;
    limit: number;
    offset: number;
  },
): Promise<{ data: KVComment[]; total: number }> {
  if (options.status && !options.keyword && !options.ownerEmail) {
    return getStatusCommentsPage(options.status, options.limit, options.offset);
  }

  const statuses = options.status ? [options.status] : COMMENT_STATUSES;
  if (!options.keyword && !options.ownerEmail) {
    return getCommentsPageAcrossStatuses(statuses, options.limit, options.offset);
  }

  const allComments = (await Promise.all(statuses.map((status) => getAllStatusComments(status)))).flat();

  let result = allComments;
  if (options.ownerEmail) {
    result = result.filter((c) => c.mail === options.ownerEmail);
  }
  if (options.keyword) {
    const kw = options.keyword.toLowerCase();
    result = result.filter((c) => c.comment.toLowerCase().includes(kw));
  }

  result.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  const total = result.length;
  return { data: result.slice(options.offset, options.offset + options.limit), total };
}

export async function getAllComments(): Promise<KVComment[]> {
  return listCommentObjectsFromKv();
}

async function listCommentObjectsFromKv(): Promise<KVComment[]> {
  const comments: KVComment[] = [];
  let cursor: string | undefined;

  do {
    const listOpts: any = { prefix: 'comment:', limit: KV_LIST_LIMIT };
    if (cursor) listOpts.cursor = cursor;
    const list = await WALINE_KV.list(listOpts);
    const keys = (list?.keys || []).map((key) => listKeyName(key)).filter(Boolean);
    const rows = await mapWithConcurrencyLimit(keys, KV_READ_CONCURRENCY, (key) => getJson<KVComment>(key));
    comments.push(...rows.filter((row): row is KVComment => !!row && Number.isFinite(row.id)));
    cursor = list?.cursor || undefined;
  } while (cursor);

  return uniqueCommentsById(comments).sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
}

async function clearKeysByPrefix(prefix: string): Promise<number> {
  let cursor: string | undefined;
  let removed = 0;

  do {
    const listOpts: any = { prefix, limit: KV_LIST_LIMIT };
    if (cursor) listOpts.cursor = cursor;
    const list = await WALINE_KV.list(listOpts);
    const keys = (list?.keys || []).map((key) => listKeyName(key)).filter(Boolean);
    removed += keys.length;
    for (let i = 0; i < keys.length; i += 50) {
      await Promise.all(keys.slice(i, i + 50).map((key) => cleanupKvKey(key)));
    }
    cursor = list?.cursor || undefined;
  } while (cursor);

  return removed;
}

function pushGrouped<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const items = map.get(key);
  if (items) {
    items.push(value);
  } else {
    map.set(key, [value]);
  }
}

function groupByStatus<T extends { status: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    pushGrouped(map, item.status || 'approved', item);
  }
  return map;
}

async function writeIdPages(
  ids: number[],
  pageSize: number,
  setPage: (page: number, pageIds: number[]) => Promise<void>,
  setPages: (pages: number) => Promise<void>,
): Promise<number> {
  const pages = Math.ceil(ids.length / pageSize);
  for (let page = 0; page < pages; page++) {
    await setPage(page, ids.slice(page * pageSize, (page + 1) * pageSize));
  }
  await setPages(pages);
  return pages;
}

export async function rebuildCommentIndexes(): Promise<{
  comments: number;
  urls: number;
  childThreads: number;
  clearedKeys: number;
}> {
  const comments = await listCommentObjectsFromKv();
  const sortedDesc = [...comments].sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  const sortedAsc = [...comments].sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));

  const clearedCounts = await Promise.all([
    clearKeysByPrefix('comments:url:'),
    clearKeysByPrefix('comments:rid:'),
    clearKeysByPrefix('count:comments:url:'),
    clearKeysByPrefix('count:comments:user:'),
    clearKeysByPrefix('count:comments:mail:'),
    clearKeysByPrefix('index:comments:status:'),
    clearKeysByPrefix('index:comments:user:'),
    clearKeysByPrefix('meta:comments:status:'),
    clearKeysByPrefix('meta:comments:url:'),
  ]);
  await cleanupKvKey('index:comments:recent');

  const statusIds = new Map<string, number[]>();
  const rootByUrl = new Map<string, KVComment[]>();
  const rootByUrlStatus = new Map<string, Map<string, KVComment[]>>();
  const childByRid = new Map<number, KVComment[]>();
  const approvedByUser = new Map<number, number>();
  const approvedByMail = new Map<string, number>();
  const userRecent = new Map<number, number[]>();

  for (const comment of sortedDesc) {
    pushGrouped(statusIds, comment.status || 'approved', comment.id);

    if (isRootComment(comment)) {
      pushGrouped(rootByUrl, comment.url, comment);
      let byStatus = rootByUrlStatus.get(comment.url);
      if (!byStatus) {
        byStatus = new Map<string, KVComment[]>();
        rootByUrlStatus.set(comment.url, byStatus);
      }
      pushGrouped(byStatus, comment.status || 'approved', comment);
    }

    if (comment.user_id !== null) {
      const ids = userRecent.get(comment.user_id) || [];
      if (ids.length < USER_RECENT_LIMIT) ids.push(comment.id);
      userRecent.set(comment.user_id, ids);
    }

    if (comment.status === 'approved') {
      if (comment.user_id !== null) {
        approvedByUser.set(comment.user_id, (approvedByUser.get(comment.user_id) || 0) + 1);
      }
      if (comment.mail) {
        const mail = normalizeMail(comment.mail);
        approvedByMail.set(mail, (approvedByMail.get(mail) || 0) + 1);
      }
    }
  }

  for (const comment of sortedAsc) {
    if (comment.rid !== null) {
      pushGrouped(childByRid, comment.rid, comment);
    }
  }

  await Promise.all(COMMENT_STATUSES.map(async (status) => {
    const ids = statusIds.get(status) || [];
    await writeIdPages(
      ids,
      STATUS_PAGE_SIZE,
      (page, pageIds) => setStatusPageIds(status, page, pageIds),
      (pages) => setStatusPages(status, pages),
    );
    await putNumberKey(countKeyStatus(status), ids.length);
  }));

  await mapWithConcurrencyLimit(Array.from(rootByUrl.entries()), 8, async ([url, roots]) => {
    const ids = roots.map((comment) => comment.id);
    await writeIdPages(
      ids,
      ROOT_PAGE_SIZE,
      (page, pageIds) => setRootPageIds(url, page, pageIds),
      (pages) => setRootPages(url, pages),
    );
    await setRootCount(url, roots.length);
  });

  await mapWithConcurrencyLimit(Array.from(rootByUrlStatus.entries()), 8, async ([url, byStatus]) => {
    await Promise.all(COMMENT_STATUSES.map(async (status) => {
      const roots = byStatus.get(status) || [];
      const ids = roots.map((comment) => comment.id);
      await writeIdPages(
        ids,
        ROOT_PAGE_SIZE,
        (page, pageIds) => setRootStatusPageIds(url, status, page, pageIds),
        (pages) => setRootStatusPages(url, status, pages),
      );
      await Promise.all([
        putNumberKey(rootStatusCountKey(url, status), roots.length),
        setRootStatusStickyIds(url, status, roots.filter((comment) => comment.sticky).map((comment) => comment.id)),
        WALINE_KV.put(rootStatusIndexedKey(url, status), ROOT_STATUS_INDEX_VERSION),
      ]);
    }));
    await bumpCommentListVersion(url);
  });

  await mapWithConcurrencyLimit(Array.from(childByRid.entries()), 12, async ([rid, children]) => {
    const byStatus = groupByStatus(children);
    await Promise.all(COMMENT_STATUSES.map((status) => (
      setChildStatusComments(rid, status, byStatus.get(status) || [])
    )));
  });

  await Promise.all([
    putJson('index:comments:recent', sortedDesc.slice(0, RECENT_LIMIT).map((comment) => comment.id)),
    ...Array.from(userRecent.entries()).map(([userId, ids]) => putJson(`index:comments:user:${userId}:recent`, ids)),
    ...Array.from(approvedByUser.entries()).map(([userId, count]) => putNumberKey(countKeyUserApproved(userId), count)),
    ...Array.from(approvedByMail.entries()).map(([mail, count]) => putNumberKey(countKeyMailApproved(mail), count)),
  ]);

  return {
    comments: comments.length,
    urls: rootByUrl.size,
    childThreads: childByRid.size,
    clearedKeys: clearedCounts.reduce((sum, count) => sum + count, 0),
  };
}

export async function clearComments(): Promise<void> {
  const prefixes = [
    'comment:',
    'comments:url:',
    'comments:rid:',
    'count:comments:url:',
    'count:comments:user:',
    'count:comments:mail:',
    'index:comments:status:',
    'meta:comments:',
    'index:comments:user:',
  ];

  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      const listOpts: any = { prefix, limit: KV_LIST_LIMIT };
      if (cursor) listOpts.cursor = cursor;
      const list = await WALINE_KV.list(listOpts);
      if (list && list.keys && list.keys.length > 0) {
        const keys = list.keys.map((k) => listKeyName(k));
        for (let i = 0; i < keys.length; i += 50) {
          await Promise.all(keys.slice(i, i + 50).map((k) => cleanupKvKey(k)));
        }
      }
      cursor = list?.cursor || undefined;
    } while (cursor);
  }

  await cleanupKvKey('index:comments:recent');
  await WALINE_KV.put('meta:next_comment_id', '1');
}

// ---------- Counter Operations ----------

export async function getCounterByUrl(url: string): Promise<KVCounter | null> {
  return getJson<KVCounter>(`counter:${url}`);
}

export async function getCountersByUrls(urls: string[]): Promise<KVCounter[]> {
  const results = await Promise.all(urls.map((url) => getCounterByUrl(url)));
  return results.filter((c): c is KVCounter => c !== null);
}

export async function createCounter(url: string, field: string): Promise<KVCounter> {
  const id = await getNextId('meta:next_counter_id');
  const now = nowIso();
  const counter: KVCounter = {
    id,
    time: 0,
    reaction0: 0,
    reaction1: 0,
    reaction2: 0,
    reaction3: 0,
    reaction4: 0,
    reaction5: 0,
    reaction6: 0,
    reaction7: 0,
    reaction8: 0,
    url,
    createdAt: now,
    updatedAt: now,
  };
  (counter as any)[field] = 1;
  await putJson(`counter:${url}`, counter);
  await WALINE_KV.put(`index:counter:id:${id}`, url);
  return counter;
}

/** 导入专用：直接写入完整 Counter 数据，保留历史时间 */
export async function importCounter(data: Partial<KVCounter> & { url: string }): Promise<KVCounter> {
  const id = await getNextId('meta:next_counter_id');
  const now = nowIso();
  const counter: KVCounter = {
    id,
    time: typeof data.time === 'number' ? data.time : 0,
    reaction0: typeof data.reaction0 === 'number' ? data.reaction0 : 0,
    reaction1: typeof data.reaction1 === 'number' ? data.reaction1 : 0,
    reaction2: typeof data.reaction2 === 'number' ? data.reaction2 : 0,
    reaction3: typeof data.reaction3 === 'number' ? data.reaction3 : 0,
    reaction4: typeof data.reaction4 === 'number' ? data.reaction4 : 0,
    reaction5: typeof data.reaction5 === 'number' ? data.reaction5 : 0,
    reaction6: typeof data.reaction6 === 'number' ? data.reaction6 : 0,
    reaction7: typeof data.reaction7 === 'number' ? data.reaction7 : 0,
    reaction8: typeof data.reaction8 === 'number' ? data.reaction8 : 0,
    url: data.url,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  await putJson(`counter:${data.url}`, counter);
  await WALINE_KV.put(`index:counter:id:${id}`, data.url);
  return counter;
}

export async function getCounterById(id: number): Promise<KVCounter | null> {
  const url = await WALINE_KV.get(`index:counter:id:${id}`);
  if (!url) return null;
  return getCounterByUrl(url);
}

export async function updateCounter(url: string, field: string, value: number): Promise<KVCounter | null> {
  const counter = await getCounterByUrl(url);
  if (!counter) return null;
  (counter as any)[field] = value;
  counter.updatedAt = nowIso();
  await putJson(`counter:${url}`, counter);
  return counter;
}

export async function getAllCounters(): Promise<KVCounter[]> {
  const counters: KVCounter[] = [];
  let cursor: string | undefined;
  do {
    const list = await WALINE_KV.list({ prefix: 'counter:', cursor, limit: KV_LIST_LIMIT });
    if (list && list.keys) {
      for (const key of list.keys) {
        // list with prefix 'counter:' should only return counter:* keys,
        // but guard against any unexpected keys just in case.
        if (!listKeyName(key).startsWith('counter:') || listKeyName(key) === 'counter:') continue;
        const c = await getJson<KVCounter>(listKeyName(key));
        if (c) counters.push(c);
      }
    }
    cursor = list?.cursor || undefined;
  } while (cursor);
  return counters;
}

export async function clearCounters(): Promise<void> {
  let cursor: string | undefined;
  do {
    const list = await WALINE_KV.list({ prefix: 'counter:', cursor, limit: KV_LIST_LIMIT });
    if (list && list.keys) {
      for (const key of list.keys) {
        await deleteKvKey(listKeyName(key));
      }
    }
    cursor = list?.cursor || undefined;
  } while (cursor);

  cursor = undefined;
  do {
    const idList = await WALINE_KV.list({ prefix: 'index:counter:id:', cursor, limit: KV_LIST_LIMIT });
    if (idList && idList.keys) {
      for (const key of idList.keys) {
        await deleteKvKey(listKeyName(key));
      }
    }
    cursor = idList?.cursor || undefined;
  } while (cursor);
  await WALINE_KV.put('meta:next_counter_id', '1');
}

// ---------- User Operations ----------

export async function createUser(data: Partial<KVUser>): Promise<KVUser> {
  const id = await getNextId('meta:next_user_id');
  const now = nowIso();
  const user: KVUser = {
    id,
    display_name: data.display_name || '',
    email: data.email || '',
    password: data.password || '',
    type: data.type || 'guest',
    label: data.label || '',
    url: data.url || '',
    avatar: data.avatar || '',
    github: data.github || '',
    twitter: data.twitter || '',
    facebook: data.facebook || '',
    google: data.google || '',
    weibo: data.weibo || '',
    qq: data.qq || '',
    '2fa': data['2fa'] || '',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };

  await putJson(`user:${id}`, user);

  const indexOps: Promise<void>[] = [
    addId('index:users:all', id, true),
  ];
  if (user.email) {
    indexOps.push(WALINE_KV.put(`index:user:email:${user.email}`, String(id)));
  }
  if (user.github) {
    indexOps.push(WALINE_KV.put(`index:user:social:github:${user.github}`, String(id)));
  }
  if (user.twitter) {
    indexOps.push(WALINE_KV.put(`index:user:social:twitter:${user.twitter}`, String(id)));
  }
  if (user.facebook) {
    indexOps.push(WALINE_KV.put(`index:user:social:facebook:${user.facebook}`, String(id)));
  }
  if (user.google) {
    indexOps.push(WALINE_KV.put(`index:user:social:google:${user.google}`, String(id)));
  }
  if (user.weibo) {
    indexOps.push(WALINE_KV.put(`index:user:social:weibo:${user.weibo}`, String(id)));
  }
  if (user.qq) {
    indexOps.push(WALINE_KV.put(`index:user:social:qq:${user.qq}`, String(id)));
  }
  await Promise.all(indexOps);

  return user;
}

export async function getUserById(id: number): Promise<KVUser | null> {
  return getJson<KVUser>(`user:${id}`);
}

export async function getUserByEmail(email: string): Promise<KVUser | null> {
  const idStr = await WALINE_KV.get(`index:user:email:${email}`);
  if (!idStr) return null;
  return getUserById(parseInt(idStr));
}

export async function getUserBySocial(field: string, value: string): Promise<KVUser | null> {
  const idStr = await WALINE_KV.get(`index:user:social:${field}:${value}`);
  if (!idStr) return null;
  return getUserById(parseInt(idStr));
}

export async function updateUser(id: number, data: Partial<KVUser>): Promise<KVUser | null> {
  const user = await getUserById(id);
  if (!user) return null;

  const oldEmail = user.email;
  const oldGithub = user.github;
  const oldTwitter = user.twitter;
  const oldFacebook = user.facebook;
  const oldGoogle = user.google;
  const oldWeibo = user.weibo;
  const oldQq = user.qq;

  Object.assign(user, data);
  user.updatedAt = nowIso();
  await putJson(`user:${id}`, user);

  if (data.email !== undefined && data.email !== oldEmail) {
    if (oldEmail) await deleteKvKey(`index:user:email:${oldEmail}`);
    if (data.email) await WALINE_KV.put(`index:user:email:${data.email}`, String(id));
  }
  if (data.github !== undefined && data.github !== oldGithub) {
    if (oldGithub) await deleteKvKey(`index:user:social:github:${oldGithub}`);
    if (data.github) await WALINE_KV.put(`index:user:social:github:${data.github}`, String(id));
  }
  if (data.twitter !== undefined && data.twitter !== oldTwitter) {
    if (oldTwitter) await deleteKvKey(`index:user:social:twitter:${oldTwitter}`);
    if (data.twitter) await WALINE_KV.put(`index:user:social:twitter:${data.twitter}`, String(id));
  }
  if (data.facebook !== undefined && data.facebook !== oldFacebook) {
    if (oldFacebook) await deleteKvKey(`index:user:social:facebook:${oldFacebook}`);
    if (data.facebook) await WALINE_KV.put(`index:user:social:facebook:${data.facebook}`, String(id));
  }
  if (data.google !== undefined && data.google !== oldGoogle) {
    if (oldGoogle) await deleteKvKey(`index:user:social:google:${oldGoogle}`);
    if (data.google) await WALINE_KV.put(`index:user:social:google:${data.google}`, String(id));
  }
  if (data.weibo !== undefined && data.weibo !== oldWeibo) {
    if (oldWeibo) await deleteKvKey(`index:user:social:weibo:${oldWeibo}`);
    if (data.weibo) await WALINE_KV.put(`index:user:social:weibo:${data.weibo}`, String(id));
  }
  if (data.qq !== undefined && data.qq !== oldQq) {
    if (oldQq) await deleteKvKey(`index:user:social:qq:${oldQq}`);
    if (data.qq) await WALINE_KV.put(`index:user:social:qq:${data.qq}`, String(id));
  }

  return user;
}

export async function deleteUserById(id: number): Promise<void> {
  const user = await getUserById(id);
  if (!user) return;

  await deleteKvKey(`user:${id}`);
  await removeId('index:users:all', id);
  if (user.email) await deleteKvKey(`index:user:email:${user.email}`);
  if (user.github) await deleteKvKey(`index:user:social:github:${user.github}`);
  if (user.twitter) await deleteKvKey(`index:user:social:twitter:${user.twitter}`);
  if (user.facebook) await deleteKvKey(`index:user:social:facebook:${user.facebook}`);
  if (user.google) await deleteKvKey(`index:user:social:google:${user.google}`);
  if (user.weibo) await deleteKvKey(`index:user:social:weibo:${user.weibo}`);
  if (user.qq) await deleteKvKey(`index:user:social:qq:${user.qq}`);
}

export async function getUsers(options: { limit: number; offset: number }): Promise<{ data: KVUser[]; total: number }> {
  const ids = await getIds('index:users:all');
  const pageIds = ids.slice(options.offset, options.offset + options.limit);
  const users = await Promise.all(pageIds.map((id) => getUserById(id)));
  return {
    data: users.filter((u): u is KVUser => u !== null),
    total: ids.length,
  };
}

export async function getUserCount(): Promise<number> {
  const ids = await getIds('index:users:all');
  return ids.length;
}

export async function getTopCommenters(limit: number): Promise<{ user: KVUser; comment_count: number }[]> {
  const ids = await getIds('index:users:all');
  const countMap = await getUserCommentCounts(ids);
  const results: { user: KVUser; comment_count: number }[] = [];
  for (const id of ids) {
    const user = await getUserById(id);
    if (!user) continue;
    results.push({ user, comment_count: countMap.get(id) || 0 });
  }
  results.sort((a, b) => b.comment_count - a.comment_count);
  return results.slice(0, limit);
}

export async function getAllUsers(): Promise<KVUser[]> {
  const ids = await getIds('index:users:all');
  const users = await Promise.all(ids.map((id) => getUserById(id)));
  return users.filter((u): u is KVUser => u !== null);
}

export async function clearUsers(): Promise<void> {
  const ids = await getIds('index:users:all');
  for (const id of ids) {
    await deleteKvKey(`user:${id}`);
  }
  await deleteKvKey('index:users:all');
  let cursor: string | undefined;
  do {
    const list = await WALINE_KV.list({ prefix: 'index:user:', cursor, limit: KV_LIST_LIMIT });
    if (list && list.keys) {
      for (const key of list.keys) {
        await deleteKvKey(listKeyName(key));
      }
    }
    cursor = list?.cursor || undefined;
  } while (cursor);
  await WALINE_KV.put('meta:next_user_id', '1');
}

// ---------- Settings Operations ----------

export async function getSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await WALINE_KV.get(`setting:${key}`);
  settingsCache.set(key, { value, expiresAt: now + SETTINGS_CACHE_TTL_MS });
  return value;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const results = await Promise.all(
    keys.map(async (key) => ({ key, val: await getSetting(key) })),
  );
  const settings: Record<string, string> = {};
  for (const { key, val } of results) {
    if (val !== null) settings[key] = val;
  }
  return settings;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};
  let cursor: string | undefined;
  do {
    const list = await WALINE_KV.list({ prefix: 'setting:', cursor, limit: KV_LIST_LIMIT });
    if (list && list.keys) {
      for (const key of list.keys) {
        const keyName = listKeyName(key);
        const val = await WALINE_KV.get(keyName);
        if (val !== null) {
          const shortKey = keyName.slice('setting:'.length);
          settings[shortKey] = val;
          settingsCache.set(shortKey, {
            value: val,
            expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
          });
        }
      }
    }
    cursor = list?.cursor || undefined;
  } while (cursor);
  return settings;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await WALINE_KV.put(`setting:${key}`, value);
  settingsCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
}

export async function setSettings(settings: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(settings).map(([key, value]) => setSetting(key, value)));
}

export async function deleteSetting(key: string): Promise<void> {
  await deleteKvKey(`setting:${key}`);
  settingsCache.delete(key);
}

export async function clearSettings(): Promise<void> {
  let cursor: string | undefined;
  do {
    const list = await WALINE_KV.list({ prefix: 'setting:', cursor, limit: KV_LIST_LIMIT });
    if (list && list.keys) {
      for (const key of list.keys) {
        await deleteKvKey(listKeyName(key));
      }
    }
    cursor = list?.cursor || undefined;
  } while (cursor);
  settingsCache.clear();
}
