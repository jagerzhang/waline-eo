// Debug login issues
export default async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Allow GET for simple testing, but require POST for actual debug
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      errno: 0,
      message: 'Login debug endpoint is ready. Send POST request with {email, password} to debug login issues.'
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ errno: 405, errmsg: 'Method Not Allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const kv = globalThis.WALINE_KV;
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ errno: 400, errmsg: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const emailLower = email.toLowerCase();

    // Try different key formats
    const keyFormats = [
      'email:' + emailLower,
      'user:email:' + emailLower,
      'users:email:' + emailLower,
    ];

    const debug = {
      email: emailLower,
      keyChecks: {},
      userData: null,
      passwordCheck: null,
    };

    for (const key of keyFormats) {
      const value = await kv.get(key);
      debug.keyChecks[key] = value;
    }

    // Use the first found userId
    const userId = debug.keyChecks['email:' + emailLower] ||
                   debug.keyChecks['user:email:' + emailLower] ||
                   debug.keyChecks['users:email:' + emailLower];

    if (userId) {
      const userDataStr = await kv.get('user:' + userId);
      if (userDataStr) {
        const user = JSON.parse(userDataStr);
        debug.userData = {
          id: user.id || user.objectId,
          email: user.email,
          hasPassword: !!user.password,
          hasSalt: !!user.salt,
          saltLength: user.salt ? user.salt.length : 0,
          passwordLength: user.password ? user.password.length : 0,
        };

        // Test password
        const salt = user.salt || '';
        const encoder = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
        const computedHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        debug.passwordCheck = {
          computedHashPrefix: computedHash.substring(0, 16) + '...',
          storedHashPrefix: user.password ? user.password.substring(0, 16) + '...' : 'none',
          match: computedHash === user.password,
        };
      } else {
        debug.userData = 'User data not found for id: ' + userId;
      }
    }

    // List all keys with email: prefix for this email
    const allEmailKeys = await kv.list({ prefix: 'email:' });
    debug.allEmailKeys = allEmailKeys.keys.map(k => k.name);

    return new Response(JSON.stringify({
      errno: 0,
      debug: debug
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (err) {
    return new Response(JSON.stringify({ errno: 500, errmsg: err.message, stack: err.stack }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
