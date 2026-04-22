/**
 * EdgeOne KV Database Layer
 * Replaces Cloudflare D1 with EdgeOne KV while preserving all Waline functionality.
 */

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
  // Match D1 datetime('now') format: YYYY-MM-DD HH:MM:SS
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

async function getIds(key: string): Promise<number[]> {
  const arr = await getJson<number[]>(key);
  return arr || [];
}

async function addId(key: string, id: number, prepend = false): Promise<void> {
  const ids = await getIds(key);
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
  const current = await WALINE_KV.get(metaKey);
  const id = current ? parseInt(current) : 1;
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

// --- 根评论分页 ---

async function getRootPageIds(url: string, page: number): Promise<number[]> {
  return getJson<number[]>(`comments:url:${url}:root:ids:page:${page}`) || [];
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
async function addRootCommentId(url: string, id: number): Promise<void> {
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
  for (let page = 0; page < pages; page++) {
    const ids = await getRootPageIds(url, page);
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      await setRootPageIds(url, page, ids);
      await setRootCount(url, await getRootCount(url) - 1);
      return;
    }
  }
}

// --- 子评论聚合 ---

async function getChildComments(rid: number): Promise<KVComment[]> {
  return getJson<KVComment[]>(`comments:rid:${rid}`) || [];
}

async function setChildComments(rid: number, comments: KVComment[]): Promise<void> {
  await putJson(`comments:rid:${rid}`, comments);
}

async function addChildComment(comment: KVComment): Promise<void> {
  const children = await getChildComments(comment.rid!);
  children.push(comment);
  await setChildComments(comment.rid!, children);
}

async function removeChildComment(rid: number, id: number): Promise<void> {
  const children = await getChildComments(rid);
  const filtered = children.filter((c) => c.id !== id);
  if (filtered.length !== children.length) {
    await setChildComments(rid, filtered);
  }
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
  const recent = (await getJson<number[]>('index:comments:recent')) || [];
  recent.unshift(id);
  if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;
  await putJson('index:comments:recent', recent);
}

async function removeRecentCommentId(id: number): Promise<void> {
  const recent = (await getJson<number[]>('index:comments:recent')) || [];
  const filtered = recent.filter((cid) => cid !== id);
  if (filtered.length !== recent.length) {
    await putJson('index:comments:recent', filtered);
  }
}

// --- 状态索引分页 ---

async function getStatusPageIds(status: string, page: number): Promise<number[]> {
  return getJson<number[]>(`index:comments:status:${status}:ids:page:${page}`) || [];
}

async function setStatusPageIds(status: string, page: number, ids: number[]): Promise<void> {
  await putJson(`index:comments:status:${status}:ids:page:${page}`, ids);
}

async function getStatusPages(status: string): Promise<number> {
  return (await getJson<number>(`meta:comments:status:${status}:pages`)) || 0;
}

async function setStatusPages(status: string, pages: number): Promise<void> {
  await putJson(`meta:comments:status:${status}:pages`, pages);
}

async function addStatusCommentId(status: string, id: number): Promise<void> {
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
}

async function removeStatusCommentId(status: string, id: number): Promise<void> {
  const pages = await getStatusPages(status);
  for (let page = 0; page < pages; page++) {
    const ids = await getStatusPageIds(status, page);
    const idx = ids.indexOf(id);
    if (idx !== -1) {
      ids.splice(idx, 1);
      await setStatusPageIds(status, page, ids);
      return;
    }
  }
}

// --- 用户评论索引（最近 100 条）---

async function addUserCommentId(userId: number, id: number): Promise<void> {
  const key = `index:comments:user:${userId}:recent`;
  const recent = (await getJson<number[]>(key)) || [];
  recent.unshift(id);
  if (recent.length > USER_RECENT_LIMIT) recent.length = USER_RECENT_LIMIT;
  await putJson(key, recent);
}

async function removeUserCommentId(userId: number, id: number): Promise<void> {
  const key = `index:comments:user:${userId}:recent`;
  const recent = (await getJson<number[]>(key)) || [];
  const filtered = recent.filter((cid) => cid !== id);
  if (filtered.length !== recent.length) {
    await putJson(key, filtered);
  }
}

// --- 核心 API ---

export async function createComment(data: Partial<KVComment>): Promise<KVComment> {
  const id = await getNextId('meta:next_comment_id');
  const now = nowIso();
  const comment: KVComment = {
    id,
    user_id: data.user_id ?? null,
    comment: data.comment || '',
    orig: data.orig || data.comment || '',
    insertedAt: now,
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
    createdAt: now,
    updatedAt: now,
  };

  await putJson(`comment:${id}`, comment);

  const ops: Promise<void>[] = [
    addRecentCommentId(id),
    addStatusCommentId(comment.status, id),
  ];

  if (comment.url && comment.rid === null && comment.pid === null) {
    ops.push(addRootCommentId(comment.url, id));
    ops.push(incCommentCount(comment.url, 1));
  }

  if (comment.rid !== null) {
    ops.push(addChildComment(comment));
  }

  if (comment.user_id !== null) {
    ops.push(addUserCommentId(comment.user_id, id));
  }

  await Promise.all(ops);

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

  Object.assign(comment, data);
  comment.updatedAt = nowIso();
  await putJson(`comment:${id}`, comment);

  const urlChanged = data.url !== undefined && data.url !== oldUrl;
  const statusChanged = data.status !== undefined && data.status !== oldStatus;
  const ridChanged = data.rid !== undefined && data.rid !== oldRid;
  const pidChanged = data.pid !== undefined && data.pid !== oldPid;
  const userChanged = data.user_id !== undefined && data.user_id !== oldUserId;

  if (urlChanged || statusChanged || ridChanged || pidChanged) {
    const removeOps: Promise<void>[] = [
      removeStatusCommentId(oldStatus, id),
      removeRecentCommentId(id),
    ];

    if (oldUrl && oldRid === null && oldPid === null) {
      removeOps.push(removeRootCommentId(oldUrl, id));
      removeOps.push(incCommentCount(oldUrl, -1));
    }

    if (oldRid !== null) {
      removeOps.push(removeChildComment(oldRid, id));
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

  return comment;
}

export async function deleteCommentById(id: number): Promise<void> {
  const comment = await getCommentById(id);
  if (!comment) return;

  await WALINE_KV.delete(`comment:${id}`);

  const ops: Promise<void>[] = [
    removeStatusCommentId(comment.status, id),
    removeRecentCommentId(id),
  ];

  if (comment.url && comment.rid === null && comment.pid === null) {
    ops.push(removeRootCommentId(comment.url, id));
    ops.push(incCommentCount(comment.url, -1));
  }

  if (comment.rid !== null) {
    ops.push(removeChildComment(comment.rid, id));
  }

  if (comment.user_id !== null) {
    ops.push(removeUserCommentId(comment.user_id, id));
  }

  await Promise.all(ops);
}

export async function deleteCommentsByRid(rid: number): Promise<void> {
  const children = await getChildComments(rid);
  await Promise.all(children.map((c) => deleteCommentById(c.id)));
}

export async function getCommentsByIds(ids: number[]): Promise<KVComment[]> {
  const comments = await Promise.all(ids.map((id) => getCommentById(id)));
  return comments.filter((c): c is KVComment => c !== null);
}

export async function getRootCommentsByUrl(
  url: string,
  options: { orderBy: string; limit: number; offset: number },
): Promise<{ comments: KVComment[]; total: number }> {
  const total = await getRootCount(url);
  if (total === 0) return { comments: [], total: 0 };

  const pages = await getRootPages(url);
  const pageStart = Math.floor(options.offset / ROOT_PAGE_SIZE);
  const pageEnd = Math.min(Math.floor((options.offset + options.limit - 1) / ROOT_PAGE_SIZE), pages - 1);

  const allComments: KVComment[] = [];
  for (let page = pageStart; page <= pageEnd; page++) {
    const ids = await getRootPageIds(url, page);
    const comments = await Promise.all(ids.map((id) => getCommentById(id)));
    allComments.push(...comments.filter((c): c is KVComment => c !== null));
  }

  const startIdxInPage = options.offset % ROOT_PAGE_SIZE;
  const sliced = allComments.slice(startIdxInPage, startIdxInPage + options.limit);

  if (options.orderBy === 'insertedAt ASC') {
    sliced.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  } else if (options.orderBy === 'like DESC') {
    sliced.sort((a, b) => b.like - a.like);
  } else {
    sliced.sort((a, b) => {
      if (b.sticky !== a.sticky) return b.sticky - a.sticky;
      return b.insertedAt.localeCompare(a.insertedAt);
    });
  }

  return { comments: sliced, total };
}

export async function getChildCommentsByRids(rids: number[], status?: string): Promise<KVComment[]> {
  const allChildren: KVComment[] = [];
  for (const rid of rids) {
    const children = await getChildComments(rid);
    allChildren.push(...children);
  }
  let result = allChildren;
  if (status) {
    result = result.filter((c) => c.status === status);
  }
  result.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  return result;
}

export async function getRecentComments(limit: number): Promise<KVComment[]> {
  const ids = (await getJson<number[]>('index:comments:recent')) || [];
  const comments = await getCommentsByIds(ids.slice(0, Math.min(ids.length, limit * 2)));
  const approved = comments.filter((c) => c.status === 'approved');
  approved.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  return approved.slice(0, limit);
}

export async function getCommentCountByUrl(url: string, _status = 'approved'): Promise<number> {
  return getCommentCount(url);
}

export async function getCommentCountsByUrls(urls: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  await Promise.all(
    urls.map(async (url) => {
      map[url] = await getCommentCount(url);
    }),
  );
  return map;
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
  const status = options.status || 'approved';
  const maxScanPages = 5;
  const pages = await getStatusPages(status);
  const scanPages = Math.min(pages, maxScanPages);

  const allComments: KVComment[] = [];
  for (let page = 0; page < scanPages; page++) {
    const ids = await getStatusPageIds(status, page);
    const comments = await getCommentsByIds(ids);
    allComments.push(...comments);
  }

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
  const maxPages = 5;
  const pages = await getStatusPages('approved');
  const scanPages = Math.min(pages, maxPages);
  const allComments: KVComment[] = [];
  for (let page = 0; page < scanPages; page++) {
    const ids = await getStatusPageIds('approved', page);
    const comments = await getCommentsByIds(ids);
    allComments.push(...comments);
  }
  return allComments;
}

export async function clearComments(): Promise<void> {
  const prefixes = [
    'comment:',
    'comments:url:',
    'comments:rid:',
    'count:comments:url:',
    'index:comments:status:',
    'meta:comments:',
    'index:comments:user:',
  ];

  for (const prefix of prefixes) {
    const list = await WALINE_KV.list({ prefix });
    if (list && list.keys) {
      const keys = list.keys.map((k) => listKeyName(k));
      // EdgeOne KV may have rate limits on deletes; batch in chunks of 50
      for (let i = 0; i < keys.length; i += 50) {
        await Promise.all(keys.slice(i, i + 50).map((k) => WALINE_KV.delete(k)));
      }
    }
  }

  await WALINE_KV.delete('index:comments:recent');
  await WALINE_KV.put('meta:next_comment_id', '1');
}

// ---------- Counter Operations ----------

export async function getCounterByUrl(url: string): Promise<KVCounter | null> {
  return getJson<KVCounter>(`counter:${url}`);
}

export async function getCountersByUrls(urls: string[]): Promise<KVCounter[]> {
  const counters: KVCounter[] = [];
  for (const url of urls) {
    const c = await getCounterByUrl(url);
    if (c) counters.push(c);
  }
  return counters;
}

export async function createCounter(url: string, field: string): Promise<KVCounter> {
  const id = await getNextId('meta:next_counter_id');
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  (counter as any)[field] = 1;
  await putJson(`counter:${url}`, counter);
  await WALINE_KV.put(`index:counter:id:${id}`, url);
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
  const list = await WALINE_KV.list({ prefix: 'counter:' });
  const counters: KVCounter[] = [];
  if (list && list.keys) {
    for (const key of list.keys) {
      // list with prefix 'counter:' should only return counter:* keys,
      // but guard against any unexpected keys just in case.
      if (!listKeyName(key).startsWith('counter:') || listKeyName(key) === 'counter:') continue;
      const c = await getJson<KVCounter>(listKeyName(key));
      if (c) counters.push(c);
    }
  }
  return counters;
}

export async function clearCounters(): Promise<void> {
  const list = await WALINE_KV.list({ prefix: 'counter:' });
  if (list && list.keys) {
    for (const key of list.keys) {
      await WALINE_KV.delete(listKeyName(key));
    }
  }
  const idList = await WALINE_KV.list({ prefix: 'index:counter:id:' });
  if (idList && idList.keys) {
    for (const key of idList.keys) {
      await WALINE_KV.delete(listKeyName(key));
    }
  }
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
    createdAt: now,
    updatedAt: now,
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
    if (oldEmail) await WALINE_KV.delete(`index:user:email:${oldEmail}`);
    if (data.email) await WALINE_KV.put(`index:user:email:${data.email}`, String(id));
  }
  if (data.github !== undefined && data.github !== oldGithub) {
    if (oldGithub) await WALINE_KV.delete(`index:user:social:github:${oldGithub}`);
    if (data.github) await WALINE_KV.put(`index:user:social:github:${data.github}`, String(id));
  }
  if (data.twitter !== undefined && data.twitter !== oldTwitter) {
    if (oldTwitter) await WALINE_KV.delete(`index:user:social:twitter:${oldTwitter}`);
    if (data.twitter) await WALINE_KV.put(`index:user:social:twitter:${data.twitter}`, String(id));
  }
  if (data.facebook !== undefined && data.facebook !== oldFacebook) {
    if (oldFacebook) await WALINE_KV.delete(`index:user:social:facebook:${oldFacebook}`);
    if (data.facebook) await WALINE_KV.put(`index:user:social:facebook:${data.facebook}`, String(id));
  }
  if (data.google !== undefined && data.google !== oldGoogle) {
    if (oldGoogle) await WALINE_KV.delete(`index:user:social:google:${oldGoogle}`);
    if (data.google) await WALINE_KV.put(`index:user:social:google:${data.google}`, String(id));
  }
  if (data.weibo !== undefined && data.weibo !== oldWeibo) {
    if (oldWeibo) await WALINE_KV.delete(`index:user:social:weibo:${oldWeibo}`);
    if (data.weibo) await WALINE_KV.put(`index:user:social:weibo:${data.weibo}`, String(id));
  }
  if (data.qq !== undefined && data.qq !== oldQq) {
    if (oldQq) await WALINE_KV.delete(`index:user:social:qq:${oldQq}`);
    if (data.qq) await WALINE_KV.put(`index:user:social:qq:${data.qq}`, String(id));
  }

  return user;
}

export async function deleteUserById(id: number): Promise<void> {
  const user = await getUserById(id);
  if (!user) return;

  await WALINE_KV.delete(`user:${id}`);
  await removeId('index:users:all', id);
  if (user.email) await WALINE_KV.delete(`index:user:email:${user.email}`);
  if (user.github) await WALINE_KV.delete(`index:user:social:github:${user.github}`);
  if (user.twitter) await WALINE_KV.delete(`index:user:social:twitter:${user.twitter}`);
  if (user.facebook) await WALINE_KV.delete(`index:user:social:facebook:${user.facebook}`);
  if (user.google) await WALINE_KV.delete(`index:user:social:google:${user.google}`);
  if (user.weibo) await WALINE_KV.delete(`index:user:social:weibo:${user.weibo}`);
  if (user.qq) await WALINE_KV.delete(`index:user:social:qq:${user.qq}`);
}

export async function getUsers(options: { limit: number; offset: number }): Promise<{ data: KVUser[]; total: number }> {
  const ids = await getIds('index:users:all');
  const users = await Promise.all(ids.map((id) => getUserById(id)));
  const valid = users.filter((u): u is KVUser => u !== null);
  valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = valid.length;
  return { data: valid.slice(options.offset, options.offset + options.limit), total };
}

export async function getUserCount(): Promise<number> {
  const ids = await getIds('index:users:all');
  return ids.length;
}

export async function getTopCommenters(limit: number): Promise<{ user: KVUser; comment_count: number }[]> {
  const ids = await getIds('index:users:all');
  const results: { user: KVUser; comment_count: number }[] = [];
  for (const id of ids) {
    const user = await getUserById(id);
    if (!user) continue;
    const commentIds = await getIds(`index:comments:user:${id}:recent`);
    let count = 0;
    if (commentIds.length > 0) {
      const comments = await getCommentsByIds(commentIds);
      count = comments.filter((c) => c.status === 'approved').length;
    }
    results.push({ user, comment_count: count });
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
    await WALINE_KV.delete(`user:${id}`);
  }
  await WALINE_KV.delete('index:users:all');
  const list = await WALINE_KV.list({ prefix: 'index:user:' });
  if (list && list.keys) {
    for (const key of list.keys) {
      await WALINE_KV.delete(listKeyName(key));
    }
  }
  await WALINE_KV.put('meta:next_user_id', '1');
}

// ---------- Settings Operations ----------

export async function getSetting(key: string): Promise<string | null> {
  return WALINE_KV.get(`setting:${key}`);
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const val = await getSetting(key);
    if (val !== null) settings[key] = val;
  }
  return settings;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const list = await WALINE_KV.list({ prefix: 'setting:' });
  const settings: Record<string, string> = {};
  if (list && list.keys) {
    for (const key of list.keys) {
      const val = await WALINE_KV.get(listKeyName(key));
      if (val !== null) {
        const shortKey = listKeyName(key).slice('setting:'.length);
        settings[shortKey] = val;
      }
    }
  }
  return settings;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await WALINE_KV.put(`setting:${key}`, value);
}

export async function setSettings(settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value);
  }
}

export async function clearSettings(): Promise<void> {
  const list = await WALINE_KV.list({ prefix: 'setting:' });
  if (list && list.keys) {
    for (const key of list.keys) {
      await WALINE_KV.delete(listKeyName(key));
    }
  }
}
