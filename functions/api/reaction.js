// Reaction API endpoint
import { WalineKV } from '../../src/kv.js';
import { corsHeaders, parseBody, createResponse, errorResponse, getQueryParams } from './_utils.js';

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
        // Get reactions for an article
        const { path } = params;

        if (!path) {
          return errorResponse('Path is required', 400, corsHeaders);
        }

        const reactionKey = `reaction:${path}`;
        const reactionsData = await db.get(reactionKey);
        const reactions = reactionsData ? JSON.parse(reactionsData) : {};

        return createResponse({
          errno: 0,
          data: reactions
        }, 200, corsHeaders);
      }

      case 'POST': {
        // Add/update reaction
        const body = await parseBody(request);
        const { path, reaction } = body;

        if (!path || !reaction) {
          return errorResponse('Path and reaction are required', 400, corsHeaders);
        }

        const reactionKey = `reaction:${path}`;
        const reactionsData = await db.get(reactionKey);
        const reactions = reactionsData ? JSON.parse(reactionsData) : {};

        // Increment reaction count
        reactions[reaction] = (reactions[reaction] || 0) + 1;

        await db.put(reactionKey, JSON.stringify(reactions));

        return createResponse({
          errno: 0,
          data: reactions
        }, 200, corsHeaders);
      }

      default:
        return errorResponse('Method Not Allowed', 405, corsHeaders);
    }
  } catch (error) {
    console.error('Reaction error:', error);
    return errorResponse(error.message || '操作失败', 500, corsHeaders);
  }
}
