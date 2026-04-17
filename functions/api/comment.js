// Comment API endpoint
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, extractBearerToken, getQueryParams } from './_utils.js';

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse user agent
 * @param {string} ua
 * @returns {Object}
 */
function parseUA(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };

  const browser = /Chrome/.test(ua) ? 'Chrome' :
                  /Firefox/.test(ua) ? 'Firefox' :
                  /Safari/.test(ua) ? 'Safari' :
                  /Edge/.test(ua) ? 'Edge' : 'Unknown';

  const os = /Windows/.test(ua) ? 'Windows' :
             /Mac/.test(ua) ? 'macOS' :
             /Linux/.test(ua) ? 'Linux' :
             /Android/.test(ua) ? 'Android' :
             /iOS/.test(ua) ? 'iOS' : 'Unknown';

  return { browser, os };
}

export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const db = new WalineKV(env.WALINE_KV);
    const url = new URL(request.url);
    const params = getQueryParams(url);

    // Authenticate if token provided
    let userInfo = null;
    let isAdmin = false;
    const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
    if (jwtSecret) {
      const token = extractBearerToken(request);
      if (token) {
        try {
          const [headerB64, payloadB64, signatureB64] = token.split('.');
          const payload = JSON.parse(atob(payloadB64));
          if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
            userInfo = payload;
            isAdmin = payload.type === 'administrator';
          }
        } catch (e) {}
      }
    }

    switch (request.method) {
      case 'GET': {
        // Get comments
        const { path, page = 1, pageSize = 10, type } = params;

        if (type === 'count') {
          // Get comment count for specific path
          if (!path) {
            return errorResponse('Path is required', 400, corsHeaders);
          }
          const comments = await db.query('comment', { url: path });
          const approvedCount = comments.filter(c => c.status === 'approved' || !c.status).length;
          return createResponse({ errno: 0, data: approvedCount }, 200, corsHeaders);
        }

        if (type === 'recent') {
          // Get recent comments
          const limit = parseInt(params.pageSize) || 10;
          const allComments = await db.list('comment');
          const sorted = allComments
            .filter(c => c.status === 'approved' || !c.status)
            .sort((a, b) => new Date(b.createdAt || b.insertedAt) - new Date(a.createdAt || a.insertedAt))
            .slice(0, limit);
          return createResponse({ errno: 0, data: sorted }, 200, corsHeaders);
        }

        // Get comments for a path
        if (!path) {
          return errorResponse('Path is required', 400, corsHeaders);
        }

        const allComments = await db.query('comment', { url: path });

        // Filter based on user permissions
        let filtered = allComments;
        if (!isAdmin) {
          if (userInfo) {
            filtered = allComments.filter(c =>
              c.status === 'approved' || !c.status || c.user_id === userInfo.objectId
            );
          } else {
            filtered = allComments.filter(c => c.status === 'approved' || !c.status);
          }
        }

        // Build comment tree
        const rootComments = filtered.filter(c => !c.pid && !c.parentId && !c.rid);
        const replies = filtered.filter(c => c.pid || c.parentId || c.rid);

        const buildTree = (comment) => {
          const commentId = comment.objectId || comment.id;
          const children = replies.filter(r =>
            (r.pid === commentId) || (r.parentId === commentId) || (r.rid === commentId)
          );
          return {
            ...comment,
            objectId: commentId,
            children: children.map(buildTree)
          };
        };

        const tree = rootComments.map(buildTree);

        // Pagination
        const total = rootComments.length;
        const start = (parseInt(page) - 1) * parseInt(pageSize);
        const paginated = tree.slice(start, start + parseInt(pageSize));

        return createResponse({
          errno: 0,
          data: paginated,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / parseInt(pageSize)),
          total
        }, 200, corsHeaders);
      }

      case 'POST': {
        // Create comment
        const body = await parseBody(request);
        const { comment, link, mail, nick, url: postUrl, pid, rid, ua } = body;

        if (!comment || !postUrl) {
          return errorResponse('评论内容和文章路径不能为空', 400, corsHeaders);
        }

        // Get client IP
        const clientIP = request.headers.get('CF-Connecting-IP') ||
                        request.headers.get('X-Forwarded-For') ||
                        '127.0.0.1';

        const uaInfo = parseUA(ua || request.headers.get('User-Agent'));

        const commentId = generateId();
        const newComment = {
          id: commentId,
          objectId: commentId,
          comment: comment,
          url: postUrl,
          nick: nick || (userInfo ? userInfo.nick : '匿名'),
          mail: mail || (userInfo ? userInfo.email : ''),
          link: link || '',
          user_id: userInfo ? userInfo.objectId : null,
          pid: pid || null,
          rid: rid || null,
          ip: clientIP,
          ua: uaInfo.browser,
          os: uaInfo.os,
          status: env.COMMENT_AUDIT === 'true' ? 'pending' : 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.create('comment', newComment);

        // Update comment count
        const countKey = `count:${postUrl}`;
        const currentCount = await db.get(countKey);
        await db.put(countKey, (parseInt(currentCount) || 0) + 1);

        return createResponse({
          errno: 0,
          data: newComment
        }, 200, corsHeaders);
      }

      case 'PUT': {
        // Update comment (like, edit)
        if (!userInfo) {
          return errorResponse('请先登录', 401, corsHeaders);
        }

        const body = await parseBody(request);
        const { objectId, comment: newContent, like } = body;

        if (!objectId) {
          return errorResponse('评论ID不能为空', 400, corsHeaders);
        }

        const comments = await db.query('comment', { objectId });
        if (comments.length === 0) {
          return errorResponse('评论不存在', 404, corsHeaders);
        }

        const existing = comments[0];

        // Check permissions
        if (!isAdmin && existing.user_id !== userInfo.objectId) {
          return errorResponse('没有权限修改此评论', 403, corsHeaders);
        }

        const updates = { ...existing };

        if (like !== undefined) {
          // Like operation
          updates.like = (existing.like || 0) + (like ? 1 : -1);
        }

        if (newContent !== undefined && isAdmin) {
          // Edit operation (admin only for now)
          updates.comment = newContent;
        }

        updates.updatedAt = new Date().toISOString();
        await db.update('comment', objectId, updates);

        return createResponse({ errno: 0, data: updates }, 200, corsHeaders);
      }

      case 'DELETE': {
        // Delete comment
        if (!userInfo) {
          return errorResponse('请先登录', 401, corsHeaders);
        }

        const { objectId } = getQueryParams(new URL(request.url));

        if (!objectId) {
          return errorResponse('评论ID不能为空', 400, corsHeaders);
        }

        const comments = await db.query('comment', { objectId });
        if (comments.length === 0) {
          return errorResponse('评论不存在', 404, corsHeaders);
        }

        const existing = comments[0];

        // Check permissions
        if (!isAdmin && existing.user_id !== userInfo.objectId) {
          return errorResponse('没有权限删除此评论', 403, corsHeaders);
        }

        await db.delete('comment', objectId);

        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Comment error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
