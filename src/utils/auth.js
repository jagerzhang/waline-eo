/**
 * Authentication utilities for Waline EdgeOne
 * Pure functions for JWT operations, token blacklist, and permission checking
 * Compatible with EdgeOne/Cloudflare Workers environment
 */

/**
 * Base64 URL-safe encoding (replaces + with -, / with _, removes =)
 * @param {string} str - String to encode
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL-safe decoding
 * @param {string} str - Base64URL encoded string
 * @returns {string} Decoded string
 */
function base64UrlDecode(str) {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

/**
 * Convert string to Uint8Array
 * @param {string} str - Input string
 * @returns {Uint8Array} Uint8Array representation
 */
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Input buffer
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Import key for HMAC-SHA256 signing
 * @param {string} secret - Secret key string
 * @returns {Promise<CryptoKey>} CryptoKey for signing
 */
async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    stringToUint8Array(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign data with HMAC-SHA256
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} Base64URL encoded signature
 */
async function signData(data, secret) {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToUint8Array(data)
  );
  return base64UrlEncode(arrayBufferToBase64(signature));
}

/**
 * Verify HMAC-SHA256 signature
 * @param {string} data - Original data
 * @param {string} signature - Base64URL encoded signature
 * @param {string} secret - Secret key
 * @returns {Promise<boolean>} True if signature is valid
 */
async function verifySignature(data, signature, secret) {
  const key = await importKey(secret);
  const expectedSig = base64UrlDecode(signature);
  const expectedBuffer = Uint8Array.from(expectedSig, c => c.charCodeAt(0));
  const dataBuffer = stringToUint8Array(data);

  return crypto.subtle.verify('HMAC', key, expectedBuffer, dataBuffer);
}

/**
 * Create a JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @param {Object} options - Token options
 * @param {number} options.expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
 * @param {string} options.issuer - Token issuer
 * @param {string} options.audience - Token audience
 * @returns {Promise<string>} JWT token string
 */
export async function sign(payload, secret, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresIn || 86400;

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const claims = {
    iat: now,
    exp: now + expiresIn,
    ...payload
  };

  if (options.issuer) claims.iss = options.issuer;
  if (options.audience) claims.aud = options.audience;

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await signData(signingInput, secret);

  return `${signingInput}.${signature}`;
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token string
 * @param {string} secret - Secret key for verification
 * @param {Object} options - Verification options
 * @param {string} options.issuer - Expected issuer
 * @param {string} options.audience - Expected audience
 * @returns {Promise<Object>} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export async function verify(token, secret, options = {}) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verify signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const isValid = await verifySignature(signingInput, signature, secret);

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new Error('Invalid token payload');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token has expired');
  }

  // Check not before
  if (payload.nbf && payload.nbf > now) {
    throw new Error('Token not yet valid');
  }

  // Verify issuer
  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error('Invalid token issuer');
  }

  // Verify audience
  if (options.audience && payload.aud !== options.audience) {
    throw new Error('Invalid token audience');
  }

  return payload;
}

/**
 * Refresh a JWT token with new expiration time
 * @param {string} token - Existing JWT token
 * @param {string} secret - Secret key
 * @param {Object} options - Refresh options
 * @param {number} options.expiresIn - New expiration time in seconds
 * @returns {Promise<string>} New JWT token
 */
export async function refresh(token, secret, options = {}) {
  const payload = await verify(token, secret);

  // Remove expiration-related claims
  delete payload.iat;
  delete payload.exp;
  delete payload.nbf;
  delete payload.jti;

  return sign(payload, secret, options);
}

/**
 * Decode a JWT token without verification (unsafe, for debugging only)
 * @param {string} token - JWT token string
 * @returns {Object|null} Decoded payload or null if invalid format
 */
export function decode(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Token blacklist storage (in-memory with TTL)
// In production, use Redis or KV store
const tokenBlacklist = new Map();

/**
 * Add a token to the blacklist
 * @param {string} token - Token to blacklist
 * @param {number} ttl - Time to live in seconds (default: 86400)
 */
export function blacklistToken(token, ttl = 86400) {
  const jti = extractJti(token);
  const exp = extractExp(token);

  // Use expiration from token or default TTL
  const expirationTime = exp || (Date.now() / 1000 + ttl);

  if (jti) {
    tokenBlacklist.set(jti, expirationTime);
  } else {
    // Fallback: hash the token
    const tokenHash = hashToken(token);
    tokenBlacklist.set(tokenHash, expirationTime);
  }

  // Cleanup expired entries periodically
  cleanupBlacklist();
}

/**
 * Check if a token is blacklisted
 * @param {string} token - Token to check
 * @returns {boolean} True if blacklisted
 */
export function isTokenBlacklisted(token) {
  const jti = extractJti(token);

  if (jti && tokenBlacklist.has(jti)) {
    const exp = tokenBlacklist.get(jti);
    if (exp > Date.now() / 1000) {
      return true;
    }
    // Clean up expired entry
    tokenBlacklist.delete(jti);
  }

  // Check by token hash
  const tokenHash = hashToken(token);
  if (tokenBlacklist.has(tokenHash)) {
    const exp = tokenBlacklist.get(tokenHash);
    if (exp > Date.now() / 1000) {
      return true;
    }
    tokenBlacklist.delete(tokenHash);
  }

  return false;
}

/**
 * Extract JTI (JWT ID) from token
 * @param {string} token - JWT token
 * @returns {string|null} JTI or null
 */
function extractJti(token) {
  try {
    const payload = decode(token);
    return payload?.jti || null;
  } catch {
    return null;
  }
}

/**
 * Extract expiration time from token
 * @param {string} token - JWT token
 * @returns {number|null} Expiration timestamp or null
 */
function extractExp(token) {
  try {
    const payload = decode(token);
    return payload?.exp || null;
  } catch {
    return null;
  }
}

/**
 * Simple hash function for token
 * @param {string} token - Token to hash
 * @returns {string} Simple hash string
 */
function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${hash}`;
}

/**
 * Clean up expired blacklist entries
 */
function cleanupBlacklist() {
  const now = Date.now() / 1000;
  for (const [key, exp] of tokenBlacklist.entries()) {
    if (exp <= now) {
      tokenBlacklist.delete(key);
    }
  }
}

// Permission levels
export const PERMISSIONS = {
  GUEST: 0,
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3
};

/**
 * Check if user has admin permission
 * @param {Object} user - User object with type/role property
 * @returns {boolean} True if user is admin
 */
export function isAdmin(user) {
  if (!user) return false;
  return user.type === 'administrator' ||
         user.role === 'admin' ||
         user.permission === PERMISSIONS.ADMIN ||
         user.level === PERMISSIONS.ADMIN;
}

/**
 * Check if user has moderator permission or higher
 * @param {Object} user - User object with type/role property
 * @returns {boolean} True if user is moderator or admin
 */
export function isModerator(user) {
  if (!user) return false;
  return user.type === 'administrator' ||
         user.type === 'moderator' ||
         user.role === 'admin' ||
         user.role === 'moderator' ||
         (user.permission >= PERMISSIONS.MODERATOR) ||
         (user.level >= PERMISSIONS.MODERATOR);
}

/**
 * Check if user has specific permission level
 * @param {Object} user - User object
 * @param {number} requiredLevel - Required permission level
 * @returns {boolean} True if user has required permission
 */
export function hasPermission(user, requiredLevel) {
  if (!user) return requiredLevel === PERMISSIONS.GUEST;

  const userLevel = user.permission || user.level || PERMISSIONS.USER;
  return userLevel >= requiredLevel;
}

/**
 * Get permission level from user object
 * @param {Object} user - User object
 * @returns {number} Permission level
 */
export function getPermissionLevel(user) {
  if (!user) return PERMISSIONS.GUEST;
  if (isAdmin(user)) return PERMISSIONS.ADMIN;
  if (isModerator(user)) return PERMISSIONS.MODERATOR;
  return user.permission || user.level || PERMISSIONS.USER;
}

/**
 * Check if user can perform action on a comment
 * @param {Object} user - Current user
 * @param {Object} comment - Comment object
 * @param {string} action - Action type (edit, delete, etc.)
 * @returns {boolean} True if allowed
 */
export function canModifyComment(user, comment, action) {
  if (!user) return false;

  // Admin can do anything
  if (isAdmin(user)) return true;

  // Moderator can edit/delete any comment
  if (isModerator(user)) {
    return action === 'edit' || action === 'delete';
  }

  // User can only modify their own comments
  if (comment.user_id === user.id || comment.email === user.email) {
    return true;
  }

  return false;
}

/**
 * Extract bearer token from Authorization header
 * @param {string|Request} requestOrHeader - Request object or Authorization header string
 * @returns {string|null} Token string or null
 */
export function extractBearerToken(requestOrHeader) {
  let authHeader = requestOrHeader;

  // If it's a Request object, extract header
  if (typeof requestOrHeader === 'object' && requestOrHeader.headers) {
    authHeader = requestOrHeader.headers.get('Authorization');
  }

  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Create authentication middleware for handlers
 * @param {string} secret - JWT secret
 * @param {Object} options - Middleware options
 * @returns {Function} Middleware function
 */
export function createAuthMiddleware(secret, options = {}) {
  return async function authMiddleware(request) {
    const token = extractBearerToken(request);

    if (!token) {
      if (options.optional) {
        return { user: null };
      }
      throw new Error('Authentication required');
    }

    if (isTokenBlacklisted(token)) {
      throw new Error('Token has been revoked');
    }

    try {
      const payload = await verify(token, secret, options);
      return { user: payload };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  };
}
