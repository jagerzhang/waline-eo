export default async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Debug: check env
    if (!env) {
      return new Response(JSON.stringify({ errno: 500, errmsg: 'env is undefined' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check available env vars
    const envVars = Object.keys(env);
    
    // Find KV binding (could be WALINE_KV or something else)
    let kv = null;
    let kvName = null;
    
    for (const key of envVars) {
      const val = env[key];
      if (val && typeof val === 'object') {
        // Check if it looks like a KV namespace
        if (typeof val.get === 'function' || typeof val.put === 'function') {
          kv = val;
          kvName = key;
          break;
        }
      }
    }

    if (!kv) {
      return new Response(JSON.stringify({ 
        errno: 500, 
        errmsg: 'No KV namespace found',
        envVars: envVars
      }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { email, password, nick } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check existing user
    const existing = await kv.get('email:' + email.toLowerCase());
    if (existing) {
      return new Response(JSON.stringify({ errno: 409, errmsg: '邮箱已注册' }), {
        status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate ID
    const userId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);

    // Hash password
    const salt = Date.now() + '' + Math.random();
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hash,
      salt: salt,
      nick: nick || email.split('@')[0],
      type: 'user',
      createdAt: new Date().toISOString()
    };

    await kv.put('user:' + userId, JSON.stringify(user));
    await kv.put('email:' + email.toLowerCase(), userId);

    return new Response(JSON.stringify({
      errno: 0,
      data: { id: userId, email: user.email, nick: user.nick },
      kvUsed: kvName
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (err) {
    return new Response(JSON.stringify({ errno: 500, errmsg: err.message, stack: err.stack }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
