// Register API endpoint - Minimal test version
export default async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    
    // Check KV
    if (!globalThis.WALINE_KV) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), { status: 500 });
    }

    // Simple test: try to get a key
    const test = await globalThis.WALINE_KV.get('test:key');
    
    return new Response(JSON.stringify({ 
      status: 'ok', 
      email: body.email,
      kvTest: test 
    }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), { status: 500 });
  }
}
