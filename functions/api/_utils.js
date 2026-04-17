// Utility functions for EdgeOne Pages Functions API endpoints

/**
 * Parse request body based on content type
 * @param {Request} request
 * @returns {Promise<Object>}
 */
export async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  }

  // Default to empty object
  return {};
}

/**
 * Get query parameters from URL
 * @param {URL} url
 * @returns {Object}
 */
export function getQueryParams(url) {
  const params = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  return params;
}

/**
 * Create JSON response with CORS headers
 * @param {Object} data
 * @param {number} status
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export function createResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * Standard CORS headers
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

/**
 * Extract bearer token from request
 * @param {Request} request
 * @returns {string|null}
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Create error response
 * @param {string} message
 * @param {number} status
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export function errorResponse(message, status = 400, corsHeaders = {}) {
  return createResponse({ errno: status, errmsg: message }, status, corsHeaders);
}

/**
 * Create success response
 * @param {Object} data
 * @param {Object} corsHeaders
 * @returns {Response}
 */
export function successResponse(data, corsHeaders = {}) {
  return createResponse({ errno: 0, data }, 200, corsHeaders);
}
