export default async function onRequest(context) {
  const { env } = context;
  
  // Check what env contains
  const envKeys = Object.keys(env);
  
  // Check WALINE_KV
  let kvInfo = 'not found';
  if (env.WALINE_KV) {
    kvInfo = {
      type: typeof env.WALINE_KV,
      keys: Object.keys(env.WALINE_KV),
      hasGet: typeof env.WALINE_KV.get === 'function',
      hasPut: typeof env.WALINE_KV.put === 'function',
      hasList: typeof env.WALINE_KV.list === 'function'
    };
  }
  
  return new Response(JSON.stringify({
    envKeys,
    walineKv: kvInfo
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
