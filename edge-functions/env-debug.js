export default async function onRequest(context) {
  const { env } = context;
  
  const debug = {
    envKeys: env ? Object.keys(env) : null,
    envJWT_TOKEN: env && env.JWT_TOKEN ? typeof env.JWT_TOKEN : 'not in env',
    globalThisJWT_TOKEN: globalThis.JWT_TOKEN ? typeof globalThis.JWT_TOKEN : 'not in globalThis',
  };
  
  // Check if JWT_TOKEN is in env as a string
  if (env && env.JWT_TOKEN) {
    debug.envJWT_TOKENValue = String(env.JWT_TOKEN).substring(0, 10) + '...';
  }
  
  // Check globalThis
  if (globalThis.JWT_TOKEN) {
    debug.globalThisJWT_TOKENValue = String(globalThis.JWT_TOKEN).substring(0, 10) + '...';
  }
  
  return new Response(JSON.stringify(debug, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
