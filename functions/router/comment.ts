import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getAvatar } from '../utils/avatar.js';
import { parseUA } from '../utils/ua.js';
import { renderMarkdown } from '../utils/markdown.js';
import { getSetting, getSettings } from './settings.js';
import { sendMail, buildMailSubject, buildMailHtml } from '../utils/mail.js';
import { sendPushPlus } from '../utils/pushplus.js';
import { validateGeetest } from '../utils/geetest.js';
import {
  getCommentListVersion,
  getPublicCommentListCache,
  hasCommentCacheAuthSignal,
  setPublicCommentListCache,
} from '../db/comment-cache.js';
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
  getUserCommentCounts,
  getMailCommentCounts,
  getUserById,
  getStatusCommentCount,
  getAllComments,
  type KVComment,
} from '../db/kv-store.js';

// Simple string hash for dedup keys
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
  if (link) {
    try {
      const profileURL = new URL(link);
      if (!['http:', 'https:'].includes(profileURL.protocol)) throw new Error();
    } catch {
      return c.json({ errno: 1, errmsg: 'link must be a valid HTTP(S) URL' }, 400);
    }
  }
  if (url && (typeof url !== 'string' || url.length > 1024)) {
    return c.json({ errno: 1, errmsg: 'url is too long (max 1024 chars)' }, 400);
  }
  if (ua && (typeof ua !== 'string' || ua.length > 1024)) {
    return c.json({ errno: 1, errmsg: 'ua is too long (max 1024 chars)' }, 400);
  }

  // Geetest 4.0 validation (only if configured, skip for administrators)
  const ip = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const userInfo = c.get('userInfo');
  const isAdmin = userInfo?.type === 'administrator';

  if (!isAdmin) {
    const [kvCaptchaId, kvCaptchaKey] = await Promise.all([
      getSetting('geetest_captcha_id').catch(() => null),
      getSetting('geetest_captcha_key').catch(() => null),
    ]);
    const gtCaptchaId = kvCaptchaId || c.env.GEETEST_CAPTCHA_ID || '';
    const gtCaptchaKey = kvCaptchaKey || c.env.GEETEST_CAPTCHA_KEY || '';
    if (!!gtCaptchaId !== !!gtCaptchaKey) {
      return c.json({ errno: 1, errmsg: '评论验证配置不完整，请联系站点管理员' }, 503);
    }
    if (gtCaptchaId && gtCaptchaKey) {
      const {
        geetest_lot_number,
        geetest_captcha_output,
        geetest_pass_token,
        geetest_gen_time,
        geetest_captcha_id,
      } = body;
      if (!geetest_lot_number || !geetest_captcha_output || !geetest_pass_token || !geetest_gen_time) {
        return c.json({ errno: 1, errmsg: '请完成人机验证后再提交评论' }, 400);
      }
      if (geetest_captcha_id && geetest_captcha_id !== gtCaptchaId) {
        return c.json({ errno: 1, errmsg: '人机验证配置不一致，请刷新页面后重试' }, 400);
      }
      const captchaFields = [geetest_lot_number, geetest_captcha_output, geetest_pass_token, geetest_gen_time];
      if (captchaFields.some((value) => typeof value !== 'string' || value.length > 16384)) {
        return c.json({ errno: 1, errmsg: '人机验证参数格式错误' }, 400);
      }
      const passed = await validateGeetest({
        captchaId: gtCaptchaId,
        captchaKey: gtCaptchaKey,
        lotNumber: geetest_lot_number,
        captchaOutput: geetest_captcha_output,
        passToken: geetest_pass_token,
        genTime: geetest_gen_time,
      });
      if (!passed) {
        return c.json({ errno: 1, errmsg: '人机验证失败，请刷新页面重试' }, 400);
      }
    }
  }

  // IPQPS rate limit (skip for administrators)
  const ipqpsRaw = (await getSetting('ipqps').catch(() => null)) || c.env.IPQPS;
  const ipqps = ipqpsRaw ? parseInt(String(ipqpsRaw)) : 60;
  if (!isAdmin && ipqps > 0) {
    const rateKey = ip || `noip:${body.mail || body.nick || 'anon'}`;
    const lastKey = `ipqps:${rateKey}`;
    const lastStr = await WALINE_KV.get(lastKey);
    const lastTime = lastStr ? parseInt(lastStr) : 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (lastTime && nowSec - lastTime < ipqps) {
      const waitSec = lastTime + ipqps - nowSec;
      return c.json({ errno: 1, errmsg: `评论发布太频繁，请 ${waitSec} 秒后再试` }, 429);
    }
  }

  // Determine initial status:
  // - administrator: always approved, no review needed
  // - comment_default_status setting: anonymous users
  // - user_comment_default_status setting: logged-in users
  // - Fallback: AUDIT env var, then approved
  let status: string;
  if (userInfo?.type === 'administrator') {
    status = 'approved';
  } else if (userInfo) {
    const userDefault = await getSetting('user_comment_default_status').catch(() => null);
    status = (userDefault === 'waiting') ? 'waiting' : 'approved';
  } else {
    const defaultStatus = await getSetting('comment_default_status').catch(() => null);
    if (defaultStatus === 'waiting' || defaultStatus === 'approved') {
      status = defaultStatus;
    } else {
      const auditSetting = await getSetting('comment_audit').catch(() => null);
      if (auditSetting === 'true' || c.env.COMMENT_AUDIT || c.env.AUDIT) {
        status = 'waiting';
      } else {
        status = 'approved';
      }
    }
  }

  // Render markdown to HTML
  const renderedComment = renderMarkdown(comment);

  // ForbiddenWords check: if content matches any forbidden keyword, mark as spam
  if (!isAdmin) {
    const forbiddenRaw = await getSetting('forbidden_words').catch(() => null);
    if (forbiddenRaw) {
      const words = forbiddenRaw.split(/[,\n]/).map((w: string) => w.trim()).filter(Boolean);
      if (words.length > 0) {
        const checkText = `${nick} ${mail} ${link} ${comment}`;
        const matched = words.some((word: string) => checkText.toLowerCase().includes(word.toLowerCase()));
        if (matched) {
          status = 'spam';
        }
      }
    }
  }

  // Duplicate content detection (skip for admin)
  if (!isAdmin) {
    const dedupContent = `${nick}:${mail}:${url}:${comment}`;
    const dedupKey = `dedup:${simpleHash(dedupContent)}`;
    const existing = await WALINE_KV.get(dedupKey);
    if (existing) {
      return c.json({ errno: 1, errmsg: '请勿重复提交相同评论' }, 400);
    }
    // Set dedup key with 10-minute expiry
    await WALINE_KV.put(dedupKey, '1', { expirationTtl: 600 });
  }

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

  // Record IP last comment timestamp for IPQPS
  if (ipqps > 0 && ip) {
    await WALINE_KV.put(`ipqps:${ip}`, String(Math.floor(Date.now() / 1000)), { expirationTtl: Math.max(60, ipqps * 2) });
  }

  // ---- Notifications (async, non-blocking) ----
  const notifyTask = async () => {
    try {
      // Load settings from KV (fall back to env)
      const settingKeys = [
        'smtp_service', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
        'sender_name', 'sender_email', 'author_email',
        'mail_subject', 'mail_template', 'mail_subject_admin', 'mail_template_admin',
        'push_plus_key', 'push_plus_topic', 'push_plus_template', 'push_plus_channel',
        'push_plus_webhook', 'push_plus_callbackurl',
        'site_name', 'site_url',
      ];
      const kvSettings = await getSettings(settingKeys);
      const cfg = (key: string) => kvSettings[key] || (c.env as any)[key.toUpperCase()] || '';

      const authorEmail = (cfg('author_email') || '').toLowerCase().trim();
      const commenterMail = (newComment.mail || '').toLowerCase().trim();
      const isAuthor = authorEmail && commenterMail === authorEmail;
      const siteName = cfg('site_name') || 'Waline';
      const siteUrl = cfg('site_url') || '';

      // Resolve parent comment if this is a reply
      let parentComment: any = null;
      if (newComment.pid || newComment.rid) {
        parentComment = await getCommentById(newComment.pid || newComment.rid || 0);
      }

      // ----- Mail notification -----
      const mailEnabled = !!(cfg('smtp_user') && cfg('smtp_pass'));
      if (mailEnabled) {
        const mailConfig = {
          smtpService: cfg('smtp_service'),
          smtpHost: cfg('smtp_host'),
          smtpPort: cfg('smtp_port'),
          smtpSecure: cfg('smtp_secure'),
          smtpUser: cfg('smtp_user'),
          smtpPass: cfg('smtp_pass'),
          senderName: cfg('sender_name'),
          senderEmail: cfg('sender_email'),
        };

        const defaultReplySubject = '您在 {{site.name}} 的评论有了新的回复';
        const defaultReplyTemplate = '<p>您好，{{parent.nick}}：</p><p>{{comment.nick}} 回复了您的评论：</p><blockquote>{{comment.content}}</blockquote><p>页面：{{comment.url}}</p><p><a href="{{comment.link}}">点击此处查看</a></p>';
        const defaultAdminSubject = '{{site.name}} 上有新评论';
        const defaultAdminTemplate = '<p>新评论来自 {{comment.nick}}（{{comment.mail}}）：</p><blockquote>{{comment.content}}</blockquote><p>页面：{{comment.url}}</p><p><a href="{{comment.link}}">点击此处查看</a></p>';

        const commentLink = siteUrl && newComment.url
          ? `${siteUrl.replace(/\/$/, '')}${newComment.url.startsWith('/') ? '' : '/'}${newComment.url}#waline`
          : siteUrl || '';
        const vars: Record<string, string> = {
          'site.name': siteName,
          'site.url': siteUrl,
          'comment.nick': newComment.nick || '',
          'comment.mail': newComment.mail || '',
          'comment.content': newComment.comment || '',
          'comment.orig': newComment.orig || '',
          'comment.url': newComment.url || '',
          'comment.link': commentLink,
          'parent.nick': parentComment?.nick || '',
          'parent.content': parentComment?.comment || '',
          'parent.mail': parentComment?.mail || '',
        };

        // Reply notification
        if (parentComment && parentComment.mail && parentComment.mail.toLowerCase() !== commenterMail) {
          try {
            await sendMail(mailConfig, {
              to: parentComment.mail,
              subject: buildMailSubject(cfg('mail_subject') || defaultReplySubject, vars),
              html: buildMailHtml(cfg('mail_template') || defaultReplyTemplate, vars),
            });
          } catch (e) {
            console.error('[Mail Reply Error]', e);
          }
        }

        // Admin notification (skip if author posted the comment)
        if (!isAuthor && authorEmail) {
          try {
            await sendMail(mailConfig, {
              to: authorEmail,
              subject: buildMailSubject(cfg('mail_subject_admin') || defaultAdminSubject, vars),
              html: buildMailHtml(cfg('mail_template_admin') || defaultAdminTemplate, vars),
            });
          } catch (e) {
            console.error('[Mail Admin Error]', e);
          }
        }
      }

      // ----- PushPlus notification -----
      const pushToken = cfg('push_plus_key');
      if (pushToken && !isAuthor) {
        try {
          const ppConfig = {
            token: pushToken,
            topic: cfg('push_plus_topic') || undefined,
            template: cfg('push_plus_template') || undefined,
            channel: cfg('push_plus_channel') || undefined,
            webhook: cfg('push_plus_webhook') || undefined,
            callbackUrl: cfg('push_plus_callbackurl') || undefined,
          };
          const ppTitle = parentComment
            ? `${siteName} - 评论回复`
            : `${siteName} - 新评论`;
          const ppContent = [
            `<b>评论者：</b>${escapeHtml(newComment.nick || '匿名')}（${escapeHtml(newComment.mail || '无邮箱')}）`,
            `<b>页面：</b>${escapeHtml(newComment.url || '')}`,
            `<b>内容：</b><br>${escapeHtml(newComment.comment || '')}`,
          ].join('<br>');
          await sendPushPlus(ppConfig, ppTitle, ppContent);
        } catch (e) {
          console.error('[PushPlus Error]', e);
        }
      }
    } catch (e) {
      console.error('[Notification Error]', e);
    }
  };

  // Fire-and-forget notification (EdgeOne Pages may not support waitUntil, but we try)
  const notifyPromise = notifyTask().catch((err) => console.error('[Notify Task Error]', err));
  if ((c as any).executionCtx?.waitUntil) {
    (c as any).executionCtx.waitUntil(notifyPromise);
  }

  const successMsg = status === 'waiting'
    ? '评论提交成功，待博主审核后才会显示。博主的回复会通过您填写的邮箱发送邮件通知你。'
    : '评论提交成功';

  return c.json({
    errno: 0,
    errmsg: successMsg,
    data: await formatComment(newComment, false, c.env),
  }, 201);
});

/**
 * PUT /api/comment/:id - Update comment
 */
commentRoutes.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ errno: 1, errmsg: 'Invalid comment id' }, 400);
  const userInfo = c.get('userInfo');
  const body = await c.req.json();
  const isAdmin = userInfo?.type === 'administrator';

  // Like action (anyone can like - increment by 1, rate-limited per IP)
  if (body.like !== undefined && typeof body.like === 'boolean') {
    const existing = await getCommentById(id);
    if (!existing) {
      return c.json({ errno: 1, errmsg: 'Comment not found' }, 404);
    }
    // Rate limit: one like per IP per comment per 60 seconds
    const likeIp = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const likeKey = `like:${id}:${likeIp}`;
    const likeRecent = await WALINE_KV.get(likeKey);
    if (likeRecent) {
      return c.json({ errno: 1, errmsg: '操作太频繁，请稍后再试' }, 429);
    }
    await WALINE_KV.put(likeKey, '1', { expirationTtl: 60 });
    const updated = await updateComment(id, {
      like: Math.max(0, (existing.like || 0) + (body.like ? 1 : -1)),
    });
    if (!updated) {
      return c.json({ errno: 1, errmsg: 'Comment not found' }, 404);
    }
    return c.json({ errno: 0, errmsg: '', data: await formatComment(updated, false, c.env) });
  }

  // Only admin can update other fields
  if (!isAdmin) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const updates: Partial<KVComment> = {};

  if (body.status !== undefined) {
    if (!['approved', 'waiting', 'spam'].includes(body.status)) {
      return c.json({ errno: 1, errmsg: 'Invalid comment status' }, 400);
    }
    updates.status = body.status;
  }
  if (body.comment !== undefined) {
    if (typeof body.comment !== 'string' || body.comment.length > 65536) {
      return c.json({ errno: 1, errmsg: 'comment is too long (max 64KB)' }, 400);
    }
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
  if (!updated) {
    return c.json({ errno: 1, errmsg: 'Comment not found' }, 404);
  }
  return c.json({ errno: 0, errmsg: '', data: await formatComment(updated, false, c.env) });
});

/**
 * DELETE /api/comment/:id - Delete comment (cascade)
 */
commentRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ errno: 1, errmsg: 'Invalid comment id' }, 400);
  const userInfo = c.get('userInfo');

  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  try {
    // Cascade delete: remove child comments
    await deleteCommentsByRid(id);
    await deleteCommentById(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Waline] delete comment ${id} failed:`, message);
    return c.json({ errno: 1, errmsg: `Delete comment failed: ${message}` }, 500);
  }

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * POST /api/comment/re-render - Re-render all comments (admin only)
 * Used to fix old comments after markdown renderer updates (e.g. emoji img fix)
 */
commentRoutes.post('/re-render', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const statuses = ['approved', 'waiting', 'spam'];
  let total = 0;
  let fixed = 0;

  for (const status of statuses) {
    const { data } = await searchComments({ status, limit: 500, offset: 0 });
    for (const comment of data) {
      total++;
      if (!comment.orig) continue;

      // Only process comments where current HTML has un-rendered emoji
      // (i.e., comment field contains escaped HTML like &lt;img class=&quot;wl-emoji&quot;)
      // Skip any comment that contains data:image (user-uploaded base64 images)
      const currentHtml = comment.comment || '';
      if (currentHtml.includes('data:image')) continue;

      // Check if there are unrendered emoji: escaped img tags in the HTML
      const hasUnrenderedEmoji = currentHtml.includes('&lt;img') && currentHtml.includes('wl-emoji');
      if (!hasUnrenderedEmoji) continue;

      const reRendered = renderMarkdown(comment.orig);
      if (reRendered !== currentHtml) {
        comment.comment = reRendered;
        await updateComment(comment.id, { comment: reRendered });

        fixed++;
      }
    }
  }

  return c.json({ errno: 0, errmsg: `已扫描 ${total} 条评论，重新渲染 ${fixed} 条` });
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

  const [kvSiteUrl, kvSiteName] = await Promise.all([
    getSetting('site_url').catch(() => null),
    getSetting('site_name').catch(() => null),
  ]);
  const siteUrl = kvSiteUrl || c.env.SITE_URL || '';
  const siteName = kvSiteName || c.env.SITE_NAME || 'Waline';

  let comments: any[] = [];

  if (path) {
    // Filter by page path
    const { comments: rootComments } = await getRootCommentsByUrl(path, {
      orderBy: 'insertedAt DESC',
      limit: 100,
      offset: 0,
      status: 'approved',
    });
    const rootIds = rootComments.map((c: KVComment) => c.id as number);
    const childComments = rootIds.length > 0 ? await getChildCommentsByRids(rootIds, 'approved') : [];
    comments = [...rootComments, ...childComments]
      .sort((a, b) => b.insertedAt.localeCompare(a.insertedAt))
      .slice(0, limit);
  } else if (email || userId) {
    // Get replies to a user's comments
    let parentIds: number[] = [];
    const allCommentsList = await getAllComments();
    parentIds = allCommentsList
      .filter((c) => c.status !== 'waiting' && c.status !== 'spam' && (
        (email && c.mail === email) || (userId && String(c.user_id) === userId)
      ))
      .map((c) => c.id as number);

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

// Level thresholds: default [0, 10, 20, 50, 100, 200]
function getLevel(count: number, levels: number[]): number {
  if (!count || levels.length === 0) return 0;
  let level = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (count >= levels[i]) {
      level = i;
      break;
    }
  }
  return level;
}

async function getLevelsConfig(): Promise<number[] | false> {
  const raw = await getSetting('levels').catch(() => null);
  if (raw === null || raw === undefined) {
    // Default levels
    return [0, 10, 20, 50, 100, 200];
  }
  if (raw === 'false' || raw === '0' || raw === '') return false;
  return raw.split(/\s*,\s*/).map(Number).filter((n) => !isNaN(n));
}

async function computeLevels(comments: any[]): Promise<Map<string, number>> {
  const levelMap = new Map<string, number>();
  const levels = await getLevelsConfig();
  if (!levels) return levelMap;

  // Collect unique user_ids and mails for anonymous users
  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))] as number[];
  const anonMails = [...new Set(
    comments.filter((c) => !c.user_id && c.mail).map((c) => c.mail as string),
  )];

  const [userCountMap, mailCountMap] = await Promise.all([
    getUserCommentCounts(userIds),
    getMailCommentCounts(anonMails),
  ]);

  // Assign levels
  for (const cmt of comments) {
    const key = cmt.user_id ? `uid:${cmt.user_id}` : `mail:${cmt.mail || ''}`;
    if (!levelMap.has(key)) {
      const count = cmt.user_id
        ? (userCountMap.get(cmt.user_id) || 0)
        : (mailCountMap.get(String(cmt.mail || '').trim().toLowerCase()) || 0);
      levelMap.set(key, getLevel(count, levels));
    }
  }

  return levelMap;
}

function getLevelKey(cmt: any): string {
  return cmt.user_id ? `uid:${cmt.user_id}` : `mail:${cmt.mail || ''}`;
}

async function getCommentList(c: any) {
  const path = c.req.query('path');
  if (!path) {
    return c.json({ errno: 1, errmsg: 'path is required' }, 400);
  }

  const userInfo = c.get('userInfo');
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10') || 10));
  const sortBy = c.req.query('sortBy') || 'insertedAt_desc';
  const cacheAuthSignal = hasCommentCacheAuthSignal({
    authorization: c.req.header('Authorization'),
    cookie: c.req.header('cookie'),
    token: c.req.query('token'),
  });
  const canUsePublicCache = !userInfo && !cacheAuthSignal;

  const orderMap: Record<string, string> = {
    insertedAt_desc: 'insertedAt DESC',
    insertedAt_asc: 'insertedAt ASC',
    like_desc: 'like DESC',
  };
  const orderBy = orderMap[sortBy] || 'insertedAt DESC';
  const offset = (page - 1) * pageSize;
  const cacheVersion = canUsePublicCache ? await getCommentListVersion(path) : 0;
  const cacheParams = canUsePublicCache
    ? { path, page, pageSize, sortBy, version: cacheVersion }
    : null;

  if (cacheParams) {
    const cached = await getPublicCommentListCache<Record<string, unknown>>(cacheParams);
    if (cached) {
      c.header('Cache-Control', 'public, max-age=30');
      c.header('X-Waline-Cache', 'HIT');
      return c.json(cached);
    }
  }

  // Get root comments (sticky first, only approved for public view)
  const { comments: rootComments, total: totalCount } = await getRootCommentsByUrl(path, {
    orderBy,
    limit: pageSize,
    offset,
    status: 'approved',
    allowIndexRebuild: !canUsePublicCache,
  });

  // If logged-in non-admin user, also fetch their own waiting root comments
  let ownWaitingRoots: any[] = [];
  if (userInfo && userInfo.type !== 'administrator' && userInfo.objectId) {
    const { comments: waitingRoots } = await getRootCommentsByUrl(path, {
      orderBy,
      limit: 100,
      offset: 0,
      status: 'waiting',
    });
    ownWaitingRoots = waitingRoots.filter((c: any) => c.user_id === userInfo.objectId);
  }

  // Merge own waiting roots with approved roots (dedup by id)
  const approvedIds = new Set(rootComments.map((r: any) => r.id));
  const mergedRoots = [...rootComments, ...ownWaitingRoots.filter((r: any) => !approvedIds.has(r.id))];

  // Get child comments for these roots
  const rootIds = mergedRoots.map((r: any) => r.id);
  let children = await getChildCommentsByRids(rootIds, 'approved');

  // Also include own waiting children
  if (userInfo && userInfo.type !== 'administrator' && userInfo.objectId) {
    const waitingChildren = await getChildCommentsByRids(rootIds, 'waiting');
    const ownWaitingChildren = waitingChildren.filter((c: any) => c.user_id === userInfo.objectId);
    const approvedChildIds = new Set(children.map((c: any) => c.id));
    children = [...children, ...ownWaitingChildren.filter((c: any) => !approvedChildIds.has(c.id))];
  }

  // Build a lookup map for reply_user (all comments by id)
  const allComments = [...mergedRoots, ...children];
  const commentMap = new Map<number, any>();
  for (const cmt of allComments) {
    commentMap.set(cmt.id, cmt);
  }

  // Batch fetch user info for type/label inheritance
  const userIds = [...new Set(allComments.map((c) => c.user_id).filter(Boolean))] as number[];
  const usersMap = new Map<number, any>();
  if (userIds.length > 0) {
    const users = (await Promise.all(userIds.map((uid) => getUserById(uid)))).filter(Boolean);
    for (const u of users) {
      usersMap.set(u!.id as number, u);
    }
  }

  // Compute levels in batch
  const levelMap = await computeLevels(allComments);

  // Pre-fetch settings once for batch formatting
  const fmtSettings = await fetchFormatSettings(c.env);

  // Build threaded structure
  const data = await Promise.all(
    mergedRoots.map(async (root: any) => {
      const rootChildren = children
        .filter((child: any) => child.rid === root.id);
      const formattedChildren = await Promise.all(
        rootChildren.map(async (child: any) => {
          const formatted = await formatComment(child, false, c.env, usersMap, fmtSettings);
          // Add reply_user: look up the parent comment by pid
          if (child.pid) {
            const parent = commentMap.get(child.pid);
            if (parent) {
              // Inherit from Users table first, fall back to raw comment row
              const parentUser = parent.user_id && usersMap ? usersMap.get(parent.user_id) : null;
              const parentNick = parentUser?.display_name || parent.nick || '';
              const parentMail = parentUser?.email || parent.mail || '';
              const parentLink = parentUser?.url || parent.link || '';
              (formatted as any).reply_user = {
                nick: parentNick,
                link: parentLink,
                avatar: await getAvatar(parentMail),
              };
            }
          }
          (formatted as any).level = levelMap.get(getLevelKey(child)) || 0;
          return formatted;
        }),
      );
      const formattedRoot = await formatComment(root, false, c.env, usersMap, fmtSettings);
      (formattedRoot as any).level = levelMap.get(getLevelKey(root)) || 0;
      return {
        ...formattedRoot,
        children: formattedChildren.reverse(),
      };
    }),
  );

  const response = {
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      count: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      data,
    },
  };

  if (cacheParams) {
    await setPublicCommentListCache(cacheParams, response);
    c.header('Cache-Control', 'public, max-age=30');
    c.header('X-Waline-Cache', 'MISS');
  }

  return c.json(response);
}

async function getRecentCommentsHandler(c: any) {
  const count = Math.min(50, Math.max(1, parseInt(c.req.query('count') || '10') || 10));
  const comments = await getRecentComments(count);
  const fmtSettings = await fetchFormatSettings(c.env);

  return c.json({
    errno: 0,
    errmsg: '',
    data: await Promise.all(comments.map((r: any) => formatComment(r, false, c.env, undefined, fmtSettings))),
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
      data: count,
    });
  }

  const countMap = await getCommentCountsByUrls(paths);
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

  const [{ data, total }, spamCount, waitingCount] = await Promise.all([
    searchComments({
      status: status || undefined,
      keyword: keyword || undefined,
      ownerEmail,
      limit: pageSize,
      offset,
    }),
    getStatusCommentCount('spam'),
    getStatusCommentCount('waiting'),
  ]);

  const fmtSettings = await fetchFormatSettings(c.env);

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      count: total,
      spamCount,
      waitingCount,
      totalPages: Math.ceil(total / pageSize),
      data: await Promise.all(data.map((r: any) => formatComment(r, true, c.env, undefined, fmtSettings))),
    },
  });
}

async function fetchFormatSettings(env?: Env): Promise<{ disableUA: boolean; authorEmail: string }> {
  const [disableUARaw, authorEmailRaw] = await Promise.all([
    getSetting('disable_useragent').catch(() => null),
    getSetting('author_email').catch(() => null),
  ]);
  return {
    disableUA: (disableUARaw === 'true') || env?.DISABLE_USERAGENT === 'true',
    authorEmail: (authorEmailRaw || env?.AUTHOR_EMAIL || '').toLowerCase().trim(),
  };
}

async function formatComment(row: any, isAdmin = false, env?: Env, usersMap?: Map<number, any>, settings?: { disableUA: boolean; authorEmail: string }) {
  if (!row) return null;
  // Use pre-fetched settings if provided, otherwise read from KV
  const { disableUA, authorEmail } = settings || await fetchFormatSettings(env);
  const { browser, os } = disableUA ? { browser: '', os: '' } : parseUA(row.ua || '');

  // Inherit nick/mail/link/type/label from Users table if user_id present
  const user = row.user_id && usersMap ? usersMap.get(row.user_id) : null;
  const nick = user?.display_name || row.nick || '';
  const mail = user?.email || row.mail || '';
  const link = user?.url || row.link || '';
  const userType = user?.type || '';
  const userLabel = user?.label || '';

  const avatar = await getAvatar(mail);
  const result: Record<string, any> = {
    objectId: row.id,
    comment: row.comment || '',
    orig: row.orig || row.comment || '',
    nick,
    link,
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
    sticky: Boolean(Number(row.sticky)),
    user_id: row.user_id,
  };

  // User type and label from Users table
  if (userType) {
    result.type = userType;
  }
  if (userLabel) {
    result.label = userLabel;
  }

  // Author email badge (fallback if no custom label set)
  if (!result.label && authorEmail && mail && mail.toLowerCase() === authorEmail) {
    result.label = '博主';
  }

  if (isAdmin) {
    result.mail = mail;
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
      <description><![CDATA[${item.description.replace(/]]>/g, ']]]]><![CDATA[>')}]]></description>
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
