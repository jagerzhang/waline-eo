import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getAvatar } from '../utils/avatar.js';
import { parseUA } from '../utils/ua.js';
import { renderMarkdown } from '../utils/markdown.js';
import { getSetting } from './settings.js';
import {
  createComment,
  getCommentById,
  updateComment,
  deleteCommentById,
  deleteCommentsByRid,
  getRootCommentsByUrl,
  getChildCommentsByRids,
  getRecentComments,
  getCommentCountByUrl,
  getCommentCountsByUrls,
  searchComments,
  type KVComment,
} from '../db/kv-store.js';

export const commentRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/comment
 * Query params:
 *   - path (required): page path
 *   - page (int, default 1)
 *   - pageSize (int, default 10, max 100)
 *   - sortBy: insertedAt_desc | insertedAt_asc | like_desc
 *   - type: (optional) recent | count | list
 */
commentRoutes.get('/', async (c) => {
  const type = c.req.query('type');

  switch (type) {
    case 'recent':
      return getRecentCommentsHandler(c);
    case 'count':
      return getCommentCountHandler(c);
    case 'list':
      return getAdminCommentList(c);
    default:
      return getCommentList(c);
  }
});

/**
 * POST /api/comment - Create comment
 */
commentRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { comment, nick, mail, link, url, ua, pid, rid, at } = body;

  if (!url) {
    return c.json({ errno: 1, errmsg: 'url is required' }, 400);
  }
  if (!comment) {
    return c.json({ errno: 1, errmsg: 'comment is required' }, 400);
  }

  // Field length limits (KV value max ~25MB, Workers CPU budget is limited for markdown rendering)
  if (typeof comment !== 'string' || comment.length > 65536) {
    return c.json({ errno: 1, errmsg: 'comment is too long (max 64KB)' }, 400);
  }
  if (nick && (typeof nick !== 'string' || nick.length > 255)) {
    return c.json({ errno: 1, errmsg: 'nick is too long (max 255 chars)' }, 400);
  }
  if (mail && (typeof mail !== 'string' || mail.length > 255)) {
    return c.json({ errno: 1, errmsg: 'mail is too long (max 255 chars)' }, 400);
  }
  if (link && (typeof link !== 'string' || link.length > 255)) {
    return c.json({ errno: 1, errmsg: 'link is too long (max 255 chars)' }, 400);
  }
  if (url && (typeof url !== 'string' || url.length > 1024)) {
    return c.json({ errno: 1, errmsg: 'url is too long (max 1024 chars)' }, 400);
  }
  if (ua && (typeof ua !== 'string' || ua.length > 1024)) {
    return c.json({ errno: 1, errmsg: 'ua is too long (max 1024 chars)' }, 400);
  }

  // EdgeOne passes client IP via x-real-ip or x-forwarded-for
  const ip = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const userInfo = c.get('userInfo');

  // Determine initial status:
  // - comment_default_status setting: anonymous users
  // - user_comment_default_status setting: logged-in users
  // - Fallback: AUDIT env var, then approved
  let status: string;
  if (userInfo) {
    const userDefault = await getSetting('user_comment_default_status').catch(() => null);
    status = (userDefault === 'waiting') ? 'waiting' : 'approved';
  } else {
    const defaultStatus = await getSetting('comment_default_status').catch(() => null);
    if (defaultStatus === 'waiting' || defaultStatus === 'approved') {
      status = defaultStatus;
    } else if (c.env.COMMENT_AUDIT || c.env.AUDIT) {
      status = 'waiting';
    } else {
      status = 'approved';
    }
  }

  // Render markdown to HTML
  const renderedComment = renderMarkdown(comment);

  const newComment = await createComment({
    user_id: userInfo?.objectId ?? null,
    comment: renderedComment,
    orig: comment,
    ip,
    link: link || '',
    mail: userInfo?.email || mail || '',
    nick: userInfo?.display_name || nick || '',
    pid: pid || null,
    rid: rid || null,
    status,
    ua: ua || '',
    url,
  });

  return c.json({
    errno: 0,
    errmsg: '',
    data: await formatComment(newComment, false, c.env),
  }, 201);
});

/**
 * PUT /api/comment/:id - Update comment
 */
commentRoutes.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const userInfo = c.get('userInfo');
  const body = await c.req.json();
  const isAdmin = userInfo?.type === 'administrator';

  // Like action (anyone can like - increment by 1)
  if (body.like !== undefined && typeof body.like === 'boolean') {
    const existing = await getCommentById(id);
    if (!existing) {
      return c.json({ errno: 1, errmsg: 'Comment not found' }, 404);
    }
    const updated = await updateComment(id, {
      like: Math.max(0, (existing.like || 0) + 1),
    });
    return c.json({ errno: 0, errmsg: '', data: await formatComment(updated, false, c.env) });
  }

  // Only admin can update other fields
  if (!isAdmin) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const updates: Partial<KVComment> = {};

  if (body.status !== undefined) {
    updates.status = body.status;
  }
  if (body.comment !== undefined) {
    updates.comment = renderMarkdown(body.comment);
    updates.orig = body.comment;
  }
  if (body.sticky !== undefined) {
    updates.sticky = body.sticky ? 1 : 0;
  }
  if (body.nick !== undefined) {
    updates.nick = body.nick;
  }
  if (body.mail !== undefined) {
    updates.mail = body.mail;
  }
  if (body.link !== undefined) {
    updates.link = body.link;
  }
  if (body.url !== undefined) {
    updates.url = body.url;
  }
  if (body.ua !== undefined) {
    updates.ua = body.ua;
  }
  if (body.ip !== undefined) {
    updates.ip = body.ip;
  }
  if (body.user_id !== undefined) {
    updates.user_id = body.user_id;
  }
  if (body.pid !== undefined) {
    updates.pid = body.pid;
  }
  if (body.rid !== undefined) {
    updates.rid = body.rid;
  }
  if (typeof body.like === 'number') {
    updates.like = Math.max(0, body.like);
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ errno: 1, errmsg: 'No fields to update' }, 400);
  }

  const updated = await updateComment(id, updates);
  return c.json({ errno: 0, errmsg: '', data: await formatComment(updated, false, c.env) });
});

/**
 * DELETE /api/comment/:id - Delete comment (cascade)
 */
commentRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const userInfo = c.get('userInfo');

  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  // Cascade delete: remove child comments
  await deleteCommentsByRid(id);
  await deleteCommentById(id);

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * GET /api/comment/rss - RSS feed for comments
 * Query params:
 *   - path: filter by page path
 *   - email / user_id: get replies to a user's comments
 *   - count: number of items (default 20, max 50)
 */
commentRoutes.get('/rss', async (c) => {
  const path = c.req.query('path');
  const email = c.req.query('email');
  const userId = c.req.query('user_id');
  const count = parseInt(c.req.query('count') || '20');
  const limit = Math.min(Math.max(Number.isFinite(count) ? count : 20, 1), 50);

  const siteUrl = c.env.SITE_URL || '';
  const siteName = c.env.SITE_NAME || 'Waline';

  let comments: any[] = [];

  if (path) {
    // Filter by page path
    const { getCommentsByIds, getIds } = await import('../db/kv-store.js');
    const ids = await getIds(`index:comments:url:${path}`);
    const all = await getCommentsByIds(ids);
    comments = all
      .filter((c) => c.status !== 'waiting' && c.status !== 'spam')
      .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt))
      .slice(0, limit);
  } else if (email || userId) {
    // Get replies to a user's comments
    const { getCommentsByIds, getIds } = await import('../db/kv-store.js');
    let parentIds: number[] = [];
    if (email && userId) {
      const allIds = await getIds('index:comments:all');
      const allComments = await getCommentsByIds(allIds);
      parentIds = allComments
        .filter((c) => c.status !== 'waiting' && c.status !== 'spam' && (c.mail === email || String(c.user_id) === userId))
        .map((c) => c.id);
    } else if (email) {
      const allIds = await getIds('index:comments:all');
      const allComments = await getCommentsByIds(allIds);
      parentIds = allComments
        .filter((c) => c.status !== 'waiting' && c.status !== 'spam' && c.mail === email)
        .map((c) => c.id);
    } else {
      const allIds = await getIds('index:comments:all');
      const allComments = await getCommentsByIds(allIds);
      parentIds = allComments
        .filter((c) => c.status !== 'waiting' && c.status !== 'spam' && String(c.user_id) === userId)
        .map((c) => c.id);
    }

    if (parentIds.length === 0) {
      return rssResponse(c, buildRssXml({
        title: `${siteName} Reply Comments`,
        link: siteUrl,
        description: 'Recent reply comments.',
        items: [],
      }));
    }

    const children = await getChildCommentsByRids(parentIds, 'approved');
    comments = children
      .filter((c) => c.status !== 'waiting' && c.status !== 'spam')
      .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt))
      .slice(0, limit);
  } else {
    // All recent comments
    comments = await getRecentComments(limit);
  }

  // Fetch user display names
  const userIds = [...new Set(comments.map((r: any) => r.user_id).filter(Boolean))];
  let users: any[] = [];
  if (userIds.length > 0) {
    const { getUserById } = await import('../db/kv-store.js');
    users = (await Promise.all(userIds.map((uid: number) => getUserById(uid)))).filter(Boolean);
  }

  // Build RSS items
  const items = comments.map((comment: any) => {
    const user = users.find((u: any) => u.id === comment.user_id);
    const nick = user?.display_name || comment.nick || 'Anonymous';
    const commentUrl = buildAbsoluteUrl(siteUrl, comment.url);
    const itemLink = commentUrl ? `${commentUrl}#${comment.id}` : '';

    return {
      title: `${nick} commented${comment.url ? ` on ${comment.url}` : ''}`,
      link: itemLink || commentUrl,
      guid: String(comment.id),
      pubDate: comment.insertedAt ? new Date(comment.insertedAt + 'Z').toUTCString() : new Date().toUTCString(),
      description: comment.comment || '',
    };
  });

  const title = path
    ? `${siteName} Comments for ${path}`
    : email || userId
      ? `${siteName} Reply Comments`
      : `${siteName} Recent Comments`;
  const description = path
    ? `Recent comments for ${path}.`
    : email || userId
      ? 'Recent reply comments.'
      : 'Recent comments.';

  return rssResponse(c, buildRssXml({ title, link: siteUrl, description, items }));
});

// --- Helper functions ---

async function getCommentList(c: any) {
  const path = c.req.query('path');
  if (!path) {
    return c.json({ errno: 1, errmsg: 'path is required' }, 400);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10') || 10));
  const sortBy = c.req.query('sortBy') || 'insertedAt_desc';

  const orderMap: Record<string, string> = {
    insertedAt_desc: 'insertedAt DESC',
    insertedAt_asc: 'insertedAt ASC',
    like_desc: 'like DESC',
  };
  const orderBy = orderMap[sortBy] || 'insertedAt DESC';
  const offset = (page - 1) * pageSize;

  // Get root comments (sticky first, only approved for public view)
  const { comments: rootComments, total: totalCount } = await getRootCommentsByUrl(path, {
    orderBy,
    limit: pageSize,
    offset,
    status: 'approved',
  });

  // Get child comments for these roots
  const rootIds = rootComments.map((r: any) => r.id);
  const children = await getChildCommentsByRids(rootIds, 'approved');

  // Build threaded structure
  const data = await Promise.all(
    rootComments.map(async (root: any) => ({
      ...(await formatComment(root, false, c.env)),
      children: await Promise.all(
        children
          .filter((child: any) => child.rid === root.id)
          .map((child: any) => formatComment(child, false, c.env)),
      ),
    })),
  );

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      count: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      data,
    },
  });
}

async function getRecentCommentsHandler(c: any) {
  const count = Math.min(50, Math.max(1, parseInt(c.req.query('count') || '10') || 10));
  const comments = await getRecentComments(count);

  return c.json({
    errno: 0,
    errmsg: '',
    data: await Promise.all(comments.map((r: any) => formatComment(r, false, c.env))),
  });
}

async function getCommentCountHandler(c: any) {
  const paths = c.req.queries('path') || c.req.queries('path[]') || [];
  if (paths.length === 0) {
    return c.json({ errno: 0, errmsg: '', data: 0 });
  }

  if (paths.length === 1) {
    const count = await getCommentCountByUrl(paths[0], 'approved');
    return c.json({
      errno: 0,
      errmsg: '',
      data: [count],
    });
  }

  const countMap = await getCommentCountsByUrls(paths, 'approved');
  return c.json({
    errno: 0,
    errmsg: '',
    data: paths.map((u: string) => countMap[u] || 0),
  });
}

async function getAdminCommentList(c: any) {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10') || 10));
  const status = c.req.query('status') || '';
  const keyword = c.req.query('keyword') || '';
  const owner = c.req.query('owner') || '';
  const offset = (page - 1) * pageSize;

  let ownerEmail: string | undefined;
  if (owner === 'mine') {
    ownerEmail = userInfo.email;
  }

  const { data, total } = await searchComments({
    status: status || undefined,
    keyword: keyword || undefined,
    ownerEmail,
    limit: pageSize,
    offset,
  });

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      spamCount: 0,
      waitingCount: 0,
      totalPages: Math.ceil(total / pageSize),
      data: await Promise.all(data.map((r: any) => formatComment(r, true, c.env))),
    },
  });
}

async function formatComment(row: any, isAdmin = false, env?: Env) {
  if (!row) return null;
  const disableUA = env?.DISABLE_USERAGENT === 'true';
  const { browser, os } = disableUA ? { browser: '', os: '' } : parseUA(row.ua || '');
  const avatar = await getAvatar(row.mail || '');
  const result: Record<string, any> = {
    objectId: row.id,
    comment: row.comment || '',
    orig: row.orig || row.comment || '',
    nick: row.nick || '',
    link: row.link || '',
    avatar,
    browser,
    os,
    time: row.insertedAt ? new Date(row.insertedAt + 'Z').getTime() : 0,
    insertedAt: row.insertedAt ? row.insertedAt + 'Z' : '',
    createdAt: row.createdAt ? row.createdAt + 'Z' : '',
    status: row.status,
    like: row.like || 0,
    url: row.url,
    pid: row.pid,
    rid: row.rid,
    sticky: Boolean(row.sticky),
    user_id: row.user_id,
  };

  // Author email badge
  if (env?.AUTHOR_EMAIL && row.mail && row.mail.toLowerCase() === env.AUTHOR_EMAIL.toLowerCase()) {
    result.label = '博主';
  }

  if (isAdmin) {
    result.mail = row.mail || '';
    result.ip = row.ip || '';
    result.ua = row.ua || '';
  }

  return result;
}

// --- RSS helpers ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAbsoluteUrl(baseUrl: string, path: string | undefined): string {
  if (!path) return baseUrl || '';
  if (/^(https?:)?\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildRssXml({ title, link, description, items }: {
  title: string;
  link: string;
  description: string;
  items: { title: string; link: string; guid: string; pubDate: string; description: string }[];
}): string {
  const now = new Date().toUTCString();
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid>${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <pubDate>${now}</pubDate>
${itemsXml}
  </channel>
</rss>`;
}

function rssResponse(c: any, xml: string): Response {
  return c.body(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  });
}
