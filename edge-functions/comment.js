// Comment API endpoint
export default async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Helper: Extract bearer token
  const getToken = () => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  };

  // Helper: Verify JWT
  const verifyJWT = async (token) => {
    try {
      const [, payloadB64] = token.split('.');
      if (!payloadB64) return null;
      const payload = JSON.parse(atob(payloadB64));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  };

  // Authenticate if token provided
  let userInfo = null;
  let isAdmin = false;
  const jwtSecret = env.JWT_TOKEN || env.JWT_SECRET;
  if (jwtSecret) {
    const token = getToken();
    if (token) {
      userInfo = await verifyJWT(token);
      isAdmin = userInfo && userInfo.type === 'administrator';
    }
  }

  const url = new URL(request.url);

  try {
    switch (request.method) {
      case 'GET': {
        const path = url.searchParams.get('path');
        const type = url.searchParams.get('type');
        const page = parseInt(url.searchParams.get('page')) || 1;
        const pageSize = parseInt(url.searchParams.get('pageSize')) || 10;

        if (type === 'recent') {
          // Get recent comments
          const { keys } = await globalThis.WALINE_KV.list({ prefix: 'waline:comment:' });
          const comments = [];
          for (const key of keys) {
            if (key.name.includes(':url:') || key.name.includes(':status:')) continue;
            const data = await globalThis.WALINE_KV.get(key.name);
            if (data) {
              const c = JSON.parse(data);
              if (c.status === 'approved' || !c.status) {
                comments.push({
                  objectId: c.objectId || c.id,
                  comment: c.comment,
                  nick: c.nick,
                  url: c.url,
                  createdAt: c.createdAt || c.insertedAt,
                  avatar: c.avatar
                });
              }
            }
          }
          comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          return new Response(JSON.stringify({ errno: 0, data: comments.slice(0, pageSize) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (!path) {
          return new Response(JSON.stringify({ errno: 400, errmsg: 'Path is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Get comments for a path
        const { keys } = await globalThis.WALINE_KV.list({ prefix: 'waline:comment:' });
        const allComments = [];
        for (const key of keys) {
          if (key.name.includes(':url:') || key.name.includes(':status:')) continue;
          const data = await globalThis.WALINE_KV.get(key.name);
          if (data) {
            const c = JSON.parse(data);
            if (c.url === path) {
              allComments.push(c);
            }
          }
        }

        // Filter based on user permissions
        let filtered = allComments;
        if (!isAdmin) {
          if (userInfo) {
            filtered = allComments.filter(c =>
              (c.status === 'approved' || !c.status) || c.user_id === userInfo.objectId
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
        const start = (page - 1) * pageSize;
        const paginated = tree.slice(start, start + pageSize);

        return new Response(JSON.stringify({
          errno: 0,
          data: paginated,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          total
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'POST': {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ errno: 400, errmsg: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { comment, link, mail, nick: bodyNick, url: postUrl, pid, rid, ua } = body;

        if (!comment || !postUrl) {
          return new Response(JSON.stringify({ errno: 400, errmsg: '评论内容和文章路径不能为空' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const clientIP = request.headers.get('CF-Connecting-IP') ||
                        request.headers.get('X-Forwarded-For') ||
                        '127.0.0.1';

        const userAgent = ua || request.headers.get('User-Agent') || '';
        const browser = /Chrome/.test(userAgent) ? 'Chrome' :
                       /Firefox/.test(userAgent) ? 'Firefox' :
                       /Safari/.test(userAgent) ? 'Safari' : 'Unknown';
        const os = /Windows/.test(userAgent) ? 'Windows' :
                  /Mac/.test(userAgent) ? 'macOS' :
                  /Linux/.test(userAgent) ? 'Linux' : 'Unknown';

        const commentId = crypto.randomUUID ? crypto.randomUUID() :
          `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;

        const newComment = {
          id: commentId,
          objectId: commentId,
          comment: comment,
          url: postUrl,
          nick: bodyNick || (userInfo ? userInfo.nick : '匿名'),
          mail: mail || (userInfo ? userInfo.email : ''),
          link: link || '',
          user_id: userInfo ? userInfo.objectId : null,
          pid: pid || null,
          rid: rid || null,
          ip: clientIP,
          ua: browser,
          os: os,
          status: env.COMMENT_AUDIT === 'true' ? 'pending' : 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await globalThis.WALINE_KV.put('waline:comment:' + commentId, JSON.stringify(newComment));

        return new Response(JSON.stringify({
          errno: 0,
          data: newComment
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'PUT': {
        if (!userInfo) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '请先登录' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ errno: 400, errmsg: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const { objectId, like } = body;

        if (!objectId) {
          return new Response(JSON.stringify({ errno: 400, errmsg: '评论ID不能为空' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const data = await globalThis.WALINE_KV.get('waline:comment:' + objectId);
        if (!data) {
          return new Response(JSON.stringify({ errno: 404, errmsg: '评论不存在' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const existing = JSON.parse(data);

        if (!isAdmin && existing.user_id !== userInfo.objectId) {
          return new Response(JSON.stringify({ errno: 403, errmsg: '没有权限修改此评论' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const updates = { ...existing };

        if (like !== undefined) {
          updates.like = (existing.like || 0) + (like ? 1 : -1);
        }

        updates.updatedAt = new Date().toISOString();
        await globalThis.WALINE_KV.put('waline:comment:' + objectId, JSON.stringify(updates));

        return new Response(JSON.stringify({ errno: 0, data: updates }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      case 'DELETE': {
        if (!userInfo) {
          return new Response(JSON.stringify({ errno: 401, errmsg: '请先登录' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const objectId = url.searchParams.get('objectId');

        if (!objectId) {
          return new Response(JSON.stringify({ errno: 400, errmsg: '评论ID不能为空' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const data = await globalThis.WALINE_KV.get('waline:comment:' + objectId);
        if (!data) {
          return new Response(JSON.stringify({ errno: 404, errmsg: '评论不存在' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const existing = JSON.parse(data);

        if (!isAdmin && existing.user_id !== userInfo.objectId) {
          return new Response(JSON.stringify({ errno: 403, errmsg: '没有权限删除此评论' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await globalThis.WALINE_KV.delete('waline:comment:' + objectId);

        return new Response(JSON.stringify({ errno: 0, data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      default:
        return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
  } catch (error) {
    console.error('Comment error:', error);
    return new Response(JSON.stringify({ errno: 500, errmsg: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
