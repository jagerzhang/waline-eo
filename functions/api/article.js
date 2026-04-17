// Article count API endpoint
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, createResponse, errorResponse, getQueryParams } from './_utils.js';

export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const db = new WalineKV(env.WALINE_KV);
    const url = new URL(request.url);
    const params = getQueryParams(url);

    switch (request.method) {
      case 'GET': {
        // Get article comment count
        const { path } = params;

        if (!path) {
          // Return all article counts
          const comments = await db.list('comment');
          const counts = {};
          comments.forEach(c => {
            if (c.url) {
              counts[c.url] = (counts[c.url] || 0) + 1;
            }
          });
          return createResponse({ errno: 0, data: counts }, 200, corsHeaders);
        }

        const comments = await db.query('comment', { url: path });
        const approvedCount = comments.filter(c => c.status === 'approved' || !c.status).length;

        return createResponse({ errno: 0, data: { [path]: approvedCount } }, 200, corsHeaders);
      }

      case 'POST': {
        // Update article count (usually not needed as it's auto-updated)
        return createResponse({ errno: 0, data: null }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Article error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
