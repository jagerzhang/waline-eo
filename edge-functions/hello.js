export default async function onRequest(context) {
  return new Response(JSON.stringify({ 
    message: 'Hello from EdgeOne!',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
