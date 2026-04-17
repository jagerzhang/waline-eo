// Recent comments API endpoint
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, createResponse, errorResponse, getQueryParams } from './_utils.js';

export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const db = new WalineKV(env.WALINE_KV);
    const url = new URL(request.url);
    const params = getQueryParams(url);
    const { pageSize = 10 } = params;

    const limit = parseInt(pageSize);
    const allComments = await db.list('comment');

    const sorted = allComments
      .filter(c => c.status === 'approved' || !c.status)
      .sort((a, b) => new Date(b.createdAt || b.insertedAt) - new Date(a.createdAt || a.insertedAt))
      .slice(0, limit)
      .map(c => ({
        objectId: c.objectId || c.id,
        comment: c.comment,
        nick: c.nick,
        url: c.url,
        createdAt: c.createdAt || c.insertedAt,
        avatar: c.avatar
      }));

    return createResponse({ errno: 0, data: sorted }, 200, corsHeaders);
  } catch (error) {
    console.error('Recent error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
