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

  // Update indexes
  await addId('index:comments:all', id, true);
  if (comment.url) {
    await addId(`index:comments:url:${comment.url}`, id, true);
    if (comment.status === 'approved' && comment.rid === null && comment.pid === null) {
      await addId(`index:comments:url:${comment.url}:approved:root`, id, true);
    }
  }
  if (comment.rid !== null) {
    await addId(`index:comments:rid:${comment.rid}`, id);
  }
  if (comment.pid !== null) {
    await addId(`index:comments:pid:${comment.pid}`, id);
  }
  await addId(`index:comments:status:${comment.status}`, id, true);
  if (comment.user_id !== null) {
    await addId(`index:comments:user:${comment.user_id}`, id);
  }

  return comment;
}

export async function getCommentById(id: number): Promise<KVComment | null> {
  return getJson<KVComment>(`comment:${id}`);
}

export async function updateComment(id: number, data: Partial<KVComment>): Promise<KVComment | null> {
  const comment = await getCommentById(id);
  if (!comment) return null;

  const oldStatus = comment.status;
  const oldRid = comment.rid;
  const oldPid = comment.pid;
  const oldUrl = comment.url;

  Object.assign(comment, data);
  comment.updatedAt = nowIso();
  await putJson(`comment:${id}`, comment);

  // Re-index if status changed
  if (data.status !== undefined && data.status !== oldStatus) {
    await removeId(`index:comments:status:${oldStatus}`, id);
    await addId(`index:comments:status:${data.status}`, id, true);
    if (oldUrl) {
      if (oldStatus === 'approved' && oldRid === null && oldPid === null) {
        await removeId(`index:comments:url:${oldUrl}:approved:root`, id);
      }
      if (data.status === 'approved' && comment.rid === null && comment.pid === null) {
        await addId(`index:comments:url:${oldUrl}:approved:root`, id, true);
      }
    }
  }

  // Re-index if url changed
  if (data.url !== undefined && data.url !== oldUrl) {
    if (oldUrl) {
      await removeId(`index:comments:url:${oldUrl}`, id);
      await removeId(`index:comments:url:${oldUrl}:approved:root`, id);
    }
    if (data.url) {
      await addId(`index:comments:url:${data.url}`, id, true);
      if (comment.status === 'approved' && comment.rid === null && comment.pid === null) {
        await addId(`index:comments:url:${data.url}:approved:root`, id, true);
      }
    }
  }

  // Re-index if rid changed
  if (data.rid !== undefined && data.rid !== oldRid) {
    if (oldRid !== null) await removeId(`index:comments:rid:${oldRid}`, id);
    if (data.rid !== null) await addId(`index:comments:rid:${data.rid}`, id);
  }

  // Re-index if pid changed
  if (data.pid !== undefined && data.pid !== oldPid) {
    if (oldPid !== null) await removeId(`index:comments:pid:${oldPid}`, id);
    if (data.pid !== null) await addId(`index:comments:pid:${data.pid}`, id);
  }

  return comment;
}

export async function deleteCommentById(id: number): Promise<void> {
  const comment = await getCommentById(id);
  if (!comment) return;

  await WALINE_KV.delete(`comment:${id}`);
  await removeId('index:comments:all', id);
  if (comment.url) {
    await removeId(`index:comments:url:${comment.url}`, id);
    await removeId(`index:comments:url:${comment.url}:approved:root`, id);
  }
  if (comment.rid !== null) {
    await removeId(`index:comments:rid:${comment.rid}`, id);
  }
  if (comment.pid !== null) {
    await removeId(`index:comments:pid:${comment.pid}`, id);
  }
  await removeId(`index:comments:status:${comment.status}`, id);
  if (comment.user_id !== null) {
    await removeId(`index:comments:user:${comment.user_id}`, id);
  }
}

export async function deleteCommentsByRid(rid: number): Promise<void> {
  const ids = await getIds(`index:comments:rid:${rid}`);
  for (const id of ids) {
    await deleteCommentById(id);
  }
}

export async function getCommentsByIds(ids: number[]): Promise<KVComment[]> {
  const comments: KVComment[] = [];
  for (const id of ids) {
    const c = await getCommentById(id);
    if (c) comments.push(c);
  }
  return comments;
}

export async function getRootCommentsByUrl(
  url: string,
  options: { orderBy: string; limit: number; offset: number },
): Promise<{ comments: KVComment[]; total: number }> {
  const ids = await getIds(`index:comments:url:${url}:approved:root`);
  // Load all and sort (sticky first, then by orderBy)
  const comments = await getCommentsByIds(ids);
  comments.sort((a, b) => {
    if (b.sticky !== a.sticky) return b.sticky - a.sticky;
    if (options.orderBy === 'insertedAt ASC') {
      return a.insertedAt.localeCompare(b.insertedAt);
    }
    if (options.orderBy === 'like DESC') {
      return b.like - a.like;
    }
    return b.insertedAt.localeCompare(a.insertedAt);
  });
  const total = comments.length;
  const sliced = comments.slice(options.offset, options.offset + options.limit);
  return { comments: sliced, total };
}

export async function getChildCommentsByRids(rids: number[], status?: string): Promise<KVComment[]> {
  const allIds: number[] = [];
  for (const rid of rids) {
    const ids = await getIds(`index:comments:rid:${rid}`);
    allIds.push(...ids);
  }
  const comments = await getCommentsByIds([...new Set(allIds)]);
  let result = comments;
  if (status) {
    result = result.filter((c) => c.status === status);
  }
  result.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  return result;
}

export async function getRecentComments(limit: number): Promise<KVComment[]> {
  const ids = await getIds('index:comments:all');
  const comments = await getCommentsByIds(ids.slice(0, limit * 2));
  const approved = comments.filter((c) => c.status === 'approved');
  approved.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  return approved.slice(0, limit);
}

export async function getCommentCountByUrl(url: string, status = 'approved'): Promise<number> {
  const ids = await getIds(`index:comments:url:${url}`);
  if (ids.length === 0) return 0;
  const comments = await getCommentsByIds(ids);
  return comments.filter((c) => c.status === status).length;
}

export async function getCommentCountsByUrls(urls: string[], status = 'approved'): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const url of urls) {
    map[url] = await getCommentCountByUrl(url, status);
  }
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
  let ids: number[];
  if (options.status) {
    ids = await getIds(`index:comments:status:${options.status}`);
  } else {
    ids = await getIds('index:comments:all');
  }

  let comments = await getCommentsByIds(ids);

  if (options.ownerEmail) {
    comments = comments.filter((c) => c.mail === options.ownerEmail);
  }
  if (options.keyword) {
    const kw = options.keyword.toLowerCase();
    comments = comments.filter((c) => c.comment.toLowerCase().includes(kw));
  }

  comments.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  const total = comments.length;
  return { data: comments.slice(options.offset, options.offset + options.limit), total };
}

export async function getAllComments(): Promise<KVComment[]> {
  const ids = await getIds('index:comments:all');
  return getCommentsByIds(ids);
}

export async function clearComments(): Promise<void> {
  const ids = await getIds('index:comments:all');
  for (const id of ids) {
    await WALINE_KV.delete(`comment:${id}`);
  }
  await WALINE_KV.delete('index:comments:all');
  // Also clear all url/status/... indexes. Simpler: list and delete by prefix
  // EdgeOne KV list may be available; fallback: we already deleted all entries above.
  // Clean known meta keys
  const list = await WALINE_KV.list({ prefix: 'index:comments:' });
  if (list && list.keys) {
    for (const key of list.keys) {
      await WALINE_KV.delete(listKeyName(key));
    }
  }
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
  await addId('index:users:all', id, true);
  if (user.email) {
    await WALINE_KV.put(`index:user:email:${user.email}`, String(id));
  }
  if (user.github) {
    await WALINE_KV.put(`index:user:social:github:${user.github}`, String(id));
  }
  if (user.twitter) {
    await WALINE_KV.put(`index:user:social:twitter:${user.twitter}`, String(id));
  }
  if (user.facebook) {
    await WALINE_KV.put(`index:user:social:facebook:${user.facebook}`, String(id));
  }
  if (user.google) {
    await WALINE_KV.put(`index:user:social:google:${user.google}`, String(id));
  }
  if (user.weibo) {
    await WALINE_KV.put(`index:user:social:weibo:${user.weibo}`, String(id));
  }
  if (user.qq) {
    await WALINE_KV.put(`index:user:social:qq:${user.qq}`, String(id));
  }

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
    const commentIds = await getIds(`index:comments:user:${id}`);
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
