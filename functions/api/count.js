// Count API endpoint
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
    const { url: paths } = params;

    if (!paths) {
      return errorResponse('URL parameter is required', 400, corsHeaders);
    }

    // Handle multiple paths
    const pathList = paths.split(',');
    const result = {};

    for (const path of pathList) {
      const comments = await db.query('comment', { url: path.trim() });
      result[path.trim()] = comments.filter(c => c.status === 'approved' || !c.status).length;
    }

    return createResponse({ errno: 0, data: result }, 200, corsHeaders);
  } catch (error) {
    console.error('Count error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
