/**
 * EdgeOne KV Database Layer
 * Replaces Cloudflare D1 with EdgeOne KV while preserving all Waline functionality.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

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

async function getJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    // Try native JSON parse first; fallback to manual parse for broader KV compatibility
    let val: any;
    try {
      val = await kv.get(key, 'json');
    } catch {
      const raw = await kv.get(key);
      if (!raw) return null;
      val = JSON.parse(raw);
    }
    return val as T;
  } catch {
    return null;
  }
}

async function putJson<T>(kv: KVNamespace, key: string, value: T): Promise<void> {
  await kv.put(key, JSON.stringify(value));
}

async function getIds(kv: KVNamespace, key: string): Promise<number[]> {
  const arr = await getJson<number[]>(kv, key);
  return arr || [];
}

async function addId(kv: KVNamespace, key: string, id: number, prepend = false): Promise<void> {
  const ids = await getIds(kv, key);
  if (ids.includes(id)) return;
  if (prepend) {
    ids.unshift(id);
  } else {
    ids.push(id);
  }
  await putJson(kv, key, ids);
}

async function removeId(kv: KVNamespace, key: string, id: number): Promise<void> {
  const ids = await getIds(kv, key);
  const filtered = ids.filter((x) => x !== id);
  if (filtered.length !== ids.length) {
    await putJson(kv, key, filtered);
  }
}

async function getNextId(kv: KVNamespace, metaKey: string): Promise<number> {
  const current = await kv.get(metaKey);
  const id = current ? parseInt(current) : 1;
  await kv.put(metaKey, String(id + 1));
  return id;
}

// ---------- Comment Operations ----------

export async function createComment(kv: KVNamespace, data: Partial<KVComment>): Promise<KVComment> {
  const id = await getNextId(kv, 'meta:next_comment_id');
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

  await putJson(kv, `comment:${id}`, comment);

  // Update indexes
  await addId(kv, 'index:comments:all', id, true);
  if (comment.url) {
    await addId(kv, `index:comments:url:${comment.url}`, id, true);
    if (comment.status === 'approved' && comment.rid === null && comment.pid === null) {
      await addId(kv, `index:comments:url:${comment.url}:approved:root`, id, true);
    }
  }
  if (comment.rid !== null) {
    await addId(kv, `index:comments:rid:${comment.rid}`, id);
  }
  if (comment.pid !== null) {
    await addId(kv, `index:comments:pid:${comment.pid}`, id);
  }
  await addId(kv, `index:comments:status:${comment.status}`, id, true);
  if (comment.user_id !== null) {
    await addId(kv, `index:comments:user:${comment.user_id}`, id);
  }

  return comment;
}

export async function getCommentById(kv: KVNamespace, id: number): Promise<KVComment | null> {
  return getJson<KVComment>(kv, `comment:${id}`);
}

export async function updateComment(kv: KVNamespace, id: number, data: Partial<KVComment>): Promise<KVComment | null> {
  const comment = await getCommentById(kv, id);
  if (!comment) return null;

  const oldStatus = comment.status;
  const oldRid = comment.rid;
  const oldPid = comment.pid;
  const oldUrl = comment.url;

  Object.assign(comment, data);
  comment.updatedAt = nowIso();
  await putJson(kv, `comment:${id}`, comment);

  // Re-index if status changed
  if (data.status !== undefined && data.status !== oldStatus) {
    await removeId(kv, `index:comments:status:${oldStatus}`, id);
    await addId(kv, `index:comments:status:${data.status}`, id, true);
    if (oldUrl) {
      if (oldStatus === 'approved' && oldRid === null && oldPid === null) {
        await removeId(kv, `index:comments:url:${oldUrl}:approved:root`, id);
      }
      if (data.status === 'approved' && comment.rid === null && comment.pid === null) {
        await addId(kv, `index:comments:url:${oldUrl}:approved:root`, id, true);
      }
    }
  }

  // Re-index if url changed
  if (data.url !== undefined && data.url !== oldUrl) {
    if (oldUrl) {
      await removeId(kv, `index:comments:url:${oldUrl}`, id);
      await removeId(kv, `index:comments:url:${oldUrl}:approved:root`, id);
    }
    if (data.url) {
      await addId(kv, `index:comments:url:${data.url}`, id, true);
      if (comment.status === 'approved' && comment.rid === null && comment.pid === null) {
        await addId(kv, `index:comments:url:${data.url}:approved:root`, id, true);
      }
    }
  }

  // Re-index if rid changed
  if (data.rid !== undefined && data.rid !== oldRid) {
    if (oldRid !== null) await removeId(kv, `index:comments:rid:${oldRid}`, id);
    if (data.rid !== null) await addId(kv, `index:comments:rid:${data.rid}`, id);
  }

  // Re-index if pid changed
  if (data.pid !== undefined && data.pid !== oldPid) {
    if (oldPid !== null) await removeId(kv, `index:comments:pid:${oldPid}`, id);
    if (data.pid !== null) await addId(kv, `index:comments:pid:${data.pid}`, id);
  }

  return comment;
}

export async function deleteCommentById(kv: KVNamespace, id: number): Promise<void> {
  const comment = await getCommentById(kv, id);
  if (!comment) return;

  await kv.delete(`comment:${id}`);
  await removeId(kv, 'index:comments:all', id);
  if (comment.url) {
    await removeId(kv, `index:comments:url:${comment.url}`, id);
    await removeId(kv, `index:comments:url:${comment.url}:approved:root`, id);
  }
  if (comment.rid !== null) {
    await removeId(kv, `index:comments:rid:${comment.rid}`, id);
  }
  if (comment.pid !== null) {
    await removeId(kv, `index:comments:pid:${comment.pid}`, id);
  }
  await removeId(kv, `index:comments:status:${comment.status}`, id);
  if (comment.user_id !== null) {
    await removeId(kv, `index:comments:user:${comment.user_id}`, id);
  }
}

export async function deleteCommentsByRid(kv: KVNamespace, rid: number): Promise<void> {
  const ids = await getIds(kv, `index:comments:rid:${rid}`);
  for (const id of ids) {
    await deleteCommentById(kv, id);
  }
}

export async function getCommentsByIds(kv: KVNamespace, ids: number[]): Promise<KVComment[]> {
  const comments: KVComment[] = [];
  for (const id of ids) {
    const c = await getCommentById(kv, id);
    if (c) comments.push(c);
  }
  return comments;
}

export async function getRootCommentsByUrl(
  kv: KVNamespace,
  url: string,
  options: { orderBy: string; limit: number; offset: number },
): Promise<{ comments: KVComment[]; total: number }> {
  const ids = await getIds(kv, `index:comments:url:${url}:approved:root`);
  // Load all and sort (sticky first, then by orderBy)
  const comments = await getCommentsByIds(kv, ids);
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

export async function getChildCommentsByRids(kv: KVNamespace, rids: number[], status?: string): Promise<KVComment[]> {
  const allIds: number[] = [];
  for (const rid of rids) {
    const ids = await getIds(kv, `index:comments:rid:${rid}`);
    allIds.push(...ids);
  }
  const comments = await getCommentsByIds(kv, [...new Set(allIds)]);
  let result = comments;
  if (status) {
    result = result.filter((c) => c.status === status);
  }
  result.sort((a, b) => a.insertedAt.localeCompare(b.insertedAt));
  return result;
}

export async function getRecentComments(kv: KVNamespace, limit: number): Promise<KVComment[]> {
  const ids = await getIds(kv, 'index:comments:all');
  const comments = await getCommentsByIds(kv, ids.slice(0, limit * 2));
  const approved = comments.filter((c) => c.status === 'approved');
  approved.sort((a, b) => b.insertedAt.localeCompare(a.insertedAt));
  return approved.slice(0, limit);
}

export async function getCommentCountByUrl(kv: KVNamespace, url: string, status = 'approved'): Promise<number> {
  const ids = await getIds(kv, `index:comments:url:${url}`);
  if (ids.length === 0) return 0;
  const comments = await getCommentsByIds(kv, ids);
  return comments.filter((c) => c.status === status).length;
}

export async function getCommentCountsByUrls(kv: KVNamespace, urls: string[], status = 'approved'): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const url of urls) {
    map[url] = await getCommentCountByUrl(kv, url, status);
  }
  return map;
}

export async function searchComments(
  kv: KVNamespace,
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
    ids = await getIds(kv, `index:comments:status:${options.status}`);
  } else {
    ids = await getIds(kv, 'index:comments:all');
  }

  let comments = await getCommentsByIds(kv, ids);

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

export async function getAllComments(kv: KVNamespace): Promise<KVComment[]> {
  const ids = await getIds(kv, 'index:comments:all');
  return getCommentsByIds(kv, ids);
}

export async function clearComments(kv: KVNamespace): Promise<void> {
  const ids = await getIds(kv, 'index:comments:all');
  for (const id of ids) {
    await kv.delete(`comment:${id}`);
  }
  await kv.delete('index:comments:all');
  // Also clear all url/status/... indexes. Simpler: list and delete by prefix
  // EdgeOne KV list may be available; fallback: we already deleted all entries above.
  // Clean known meta keys
  const list = await kv.list({ prefix: 'index:comments:' });
  for (const key of list.keys) {
    await kv.delete(key.name);
  }
  await kv.put('meta:next_comment_id', '1');
}

// ---------- Counter Operations ----------

export async function getCounterByUrl(kv: KVNamespace, url: string): Promise<KVCounter | null> {
  return getJson<KVCounter>(kv, `counter:${url}`);
}

export async function getCountersByUrls(kv: KVNamespace, urls: string[]): Promise<KVCounter[]> {
  const counters: KVCounter[] = [];
  for (const url of urls) {
    const c = await getCounterByUrl(kv, url);
    if (c) counters.push(c);
  }
  return counters;
}

export async function createCounter(kv: KVNamespace, url: string, field: string): Promise<KVCounter> {
  const id = await getNextId(kv, 'meta:next_counter_id');
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
  await putJson(kv, `counter:${url}`, counter);
  await kv.put(`index:counter:id:${id}`, url);
  return counter;
}

export async function getCounterById(kv: KVNamespace, id: number): Promise<KVCounter | null> {
  const url = await kv.get(`index:counter:id:${id}`);
  if (!url) return null;
  return getCounterByUrl(kv, url);
}

export async function updateCounter(kv: KVNamespace, url: string, field: string, value: number): Promise<KVCounter | null> {
  const counter = await getCounterByUrl(kv, url);
  if (!counter) return null;
  (counter as any)[field] = value;
  counter.updatedAt = nowIso();
  await putJson(kv, `counter:${url}`, counter);
  return counter;
}

export async function getAllCounters(kv: KVNamespace): Promise<KVCounter[]> {
  const list = await kv.list({ prefix: 'counter:' });
  const counters: KVCounter[] = [];
  for (const key of list.keys) {
    // list with prefix 'counter:' should only return counter:* keys,
    // but guard against any unexpected keys just in case.
    if (!key.name.startsWith('counter:') || key.name === 'counter:') continue;
    const c = await getJson<KVCounter>(kv, key.name);
    if (c) counters.push(c);
  }
  return counters;
}

export async function clearCounters(kv: KVNamespace): Promise<void> {
  const list = await kv.list({ prefix: 'counter:' });
  for (const key of list.keys) {
    await kv.delete(key.name);
  }
  const idList = await kv.list({ prefix: 'index:counter:id:' });
  for (const key of idList.keys) {
    await kv.delete(key.name);
  }
  await kv.put('meta:next_counter_id', '1');
}

// ---------- User Operations ----------

export async function createUser(kv: KVNamespace, data: Partial<KVUser>): Promise<KVUser> {
  const id = await getNextId(kv, 'meta:next_user_id');
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

  await putJson(kv, `user:${id}`, user);
  await addId(kv, 'index:users:all', id, true);
  if (user.email) {
    await kv.put(`index:user:email:${user.email}`, String(id));
  }
  if (user.github) {
    await kv.put(`index:user:social:github:${user.github}`, String(id));
  }
  if (user.twitter) {
    await kv.put(`index:user:social:twitter:${user.twitter}`, String(id));
  }
  if (user.facebook) {
    await kv.put(`index:user:social:facebook:${user.facebook}`, String(id));
  }
  if (user.google) {
    await kv.put(`index:user:social:google:${user.google}`, String(id));
  }
  if (user.weibo) {
    await kv.put(`index:user:social:weibo:${user.weibo}`, String(id));
  }
  if (user.qq) {
    await kv.put(`index:user:social:qq:${user.qq}`, String(id));
  }

  return user;
}

export async function getUserById(kv: KVNamespace, id: number): Promise<KVUser | null> {
  return getJson<KVUser>(kv, `user:${id}`);
}

export async function getUserByEmail(kv: KVNamespace, email: string): Promise<KVUser | null> {
  const idStr = await kv.get(`index:user:email:${email}`);
  if (!idStr) return null;
  return getUserById(kv, parseInt(idStr));
}

export async function getUserBySocial(kv: KVNamespace, field: string, value: string): Promise<KVUser | null> {
  const idStr = await kv.get(`index:user:social:${field}:${value}`);
  if (!idStr) return null;
  return getUserById(kv, parseInt(idStr));
}

export async function updateUser(kv: KVNamespace, id: number, data: Partial<KVUser>): Promise<KVUser | null> {
  const user = await getUserById(kv, id);
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
  await putJson(kv, `user:${id}`, user);

  if (data.email !== undefined && data.email !== oldEmail) {
    if (oldEmail) await kv.delete(`index:user:email:${oldEmail}`);
    if (data.email) await kv.put(`index:user:email:${data.email}`, String(id));
  }
  if (data.github !== undefined && data.github !== oldGithub) {
    if (oldGithub) await kv.delete(`index:user:social:github:${oldGithub}`);
    if (data.github) await kv.put(`index:user:social:github:${data.github}`, String(id));
  }
  if (data.twitter !== undefined && data.twitter !== oldTwitter) {
    if (oldTwitter) await kv.delete(`index:user:social:twitter:${oldTwitter}`);
    if (data.twitter) await kv.put(`index:user:social:twitter:${data.twitter}`, String(id));
  }
  if (data.facebook !== undefined && data.facebook !== oldFacebook) {
    if (oldFacebook) await kv.delete(`index:user:social:facebook:${oldFacebook}`);
    if (data.facebook) await kv.put(`index:user:social:facebook:${data.facebook}`, String(id));
  }
  if (data.google !== undefined && data.google !== oldGoogle) {
    if (oldGoogle) await kv.delete(`index:user:social:google:${oldGoogle}`);
    if (data.google) await kv.put(`index:user:social:google:${data.google}`, String(id));
  }
  if (data.weibo !== undefined && data.weibo !== oldWeibo) {
    if (oldWeibo) await kv.delete(`index:user:social:weibo:${oldWeibo}`);
    if (data.weibo) await kv.put(`index:user:social:weibo:${data.weibo}`, String(id));
  }
  if (data.qq !== undefined && data.qq !== oldQq) {
    if (oldQq) await kv.delete(`index:user:social:qq:${oldQq}`);
    if (data.qq) await kv.put(`index:user:social:qq:${data.qq}`, String(id));
  }

  return user;
}

export async function deleteUserById(kv: KVNamespace, id: number): Promise<void> {
  const user = await getUserById(kv, id);
  if (!user) return;

  await kv.delete(`user:${id}`);
  await removeId(kv, 'index:users:all', id);
  if (user.email) await kv.delete(`index:user:email:${user.email}`);
  if (user.github) await kv.delete(`index:user:social:github:${user.github}`);
  if (user.twitter) await kv.delete(`index:user:social:twitter:${user.twitter}`);
  if (user.facebook) await kv.delete(`index:user:social:facebook:${user.facebook}`);
  if (user.google) await kv.delete(`index:user:social:google:${user.google}`);
  if (user.weibo) await kv.delete(`index:user:social:weibo:${user.weibo}`);
  if (user.qq) await kv.delete(`index:user:social:qq:${user.qq}`);
}

export async function getUsers(kv: KVNamespace, options: { limit: number; offset: number }): Promise<{ data: KVUser[]; total: number }> {
  const ids = await getIds(kv, 'index:users:all');
  const users = await Promise.all(ids.map((id) => getUserById(kv, id)));
  const valid = users.filter((u): u is KVUser => u !== null);
  valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = valid.length;
  return { data: valid.slice(options.offset, options.offset + options.limit), total };
}

export async function getUserCount(kv: KVNamespace): Promise<number> {
  const ids = await getIds(kv, 'index:users:all');
  return ids.length;
}

export async function getTopCommenters(kv: KVNamespace, limit: number): Promise<{ user: KVUser; comment_count: number }[]> {
  const ids = await getIds(kv, 'index:users:all');
  const results: { user: KVUser; comment_count: number }[] = [];
  for (const id of ids) {
    const user = await getUserById(kv, id);
    if (!user) continue;
    const commentIds = await getIds(kv, `index:comments:user:${id}`);
    let count = 0;
    if (commentIds.length > 0) {
      const comments = await getCommentsByIds(kv, commentIds);
      count = comments.filter((c) => c.status === 'approved').length;
    }
    results.push({ user, comment_count: count });
  }
  results.sort((a, b) => b.comment_count - a.comment_count);
  return results.slice(0, limit);
}

export async function getAllUsers(kv: KVNamespace): Promise<KVUser[]> {
  const ids = await getIds(kv, 'index:users:all');
  const users = await Promise.all(ids.map((id) => getUserById(kv, id)));
  return users.filter((u): u is KVUser => u !== null);
}

export async function clearUsers(kv: KVNamespace): Promise<void> {
  const ids = await getIds(kv, 'index:users:all');
  for (const id of ids) {
    await kv.delete(`user:${id}`);
  }
  await kv.delete('index:users:all');
  const list = await kv.list({ prefix: 'index:user:' });
  for (const key of list.keys) {
    await kv.delete(key.name);
  }
  await kv.put('meta:next_user_id', '1');
}

// ---------- Settings Operations ----------

export async function getSetting(kv: KVNamespace, key: string): Promise<string | null> {
  return kv.get(`setting:${key}`);
}

export async function getSettings(kv: KVNamespace, keys: string[]): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};
  for (const key of keys) {
    const val = await getSetting(kv, key);
    if (val !== null) settings[key] = val;
  }
  return settings;
}

export async function getAllSettings(kv: KVNamespace): Promise<Record<string, string>> {
  const list = await kv.list({ prefix: 'setting:' });
  const settings: Record<string, string> = {};
  for (const key of list.keys) {
    const val = await kv.get(key.name);
    if (val !== null) {
      const shortKey = key.name.slice('setting:'.length);
      settings[shortKey] = val;
    }
  }
  return settings;
}

export async function setSetting(kv: KVNamespace, key: string, value: string): Promise<void> {
  await kv.put(`setting:${key}`, value);
}

export async function setSettings(kv: KVNamespace, settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(kv, key, value);
  }
}

export async function clearSettings(kv: KVNamespace): Promise<void> {
  const list = await kv.list({ prefix: 'setting:' });
  for (const key of list.keys) {
    await kv.delete(key.name);
  }
}
