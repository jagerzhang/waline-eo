// Test endpoint - minimal version
export default async function onRequest(context) {
  return new Response(JSON.stringify({ status: 'ok', message: 'Hello from EdgeOne!' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
