/**
 * IP address utilities for Waline EdgeOne
 * Pure functions for IP to region conversion, disallow list checking, and frequency limiting
 * Compatible with EdgeOne/Cloudflare Workers environment
 */

// IP region cache (in-memory)
const regionCache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// IP frequency tracking
const ipRequestLog = new Map();

/**
 * Extract client IP from request
 * @param {Request} request - HTTP request object
 * @returns {string} Client IP address
 */
export function getClientIP(request) {
  // Check Cloudflare-specific headers
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) return cfConnectingIp;

  // Check EdgeOne-specific headers
  const edgeOneIp = request.headers.get('EO-Client-IP') ||
                    request.headers.get('X-EdgeOne-Client-IP');
  if (edgeOneIp) return edgeOneIp;

  // Check standard forwarding headers
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    // Get the first IP in the chain (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('X-Real-IP');
  if (realIp) return realIp;

  // Fallback to socket remote address (if available)
  // Note: This may not be available in all edge environments
  return 'unknown';
}

/**
 * Validate IP address format (IPv4 and IPv6)
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP
 */
export function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;

  // IPv4 validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) return true;

  // IPv6 validation (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^:(?::[0-9a-fA-F]{1,4}){1,7}$|^::$/;
  if (ipv6Regex.test(ip)) return true;

  return false;
}

/**
 * Convert IP to integer for range comparisons
 * @param {string} ip - IPv4 address
 * @returns {number} Integer representation
 */
export function ipToInt(ip) {
  if (!isValidIP(ip)) return 0;

  const parts = ip.split('.');
  if (parts.length !== 4) return 0;

  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Convert integer to IP address
 * @param {number} int - Integer representation
 * @returns {string} IPv4 address
 */
export function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255
  ].join('.');
}

/**
 * Check if IP is in CIDR range
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns {boolean} True if IP is in range
 */
export function isIPInCIDR(ip, cidr) {
  if (!isValidIP(ip)) return false;

  const [rangeIp, prefix] = cidr.split('/');
  if (!rangeIp || !prefix) return false;

  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(rangeIp);
  const mask = -1 << (32 - parseInt(prefix, 10));

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Check if IP is in any of the CIDR ranges
 * @param {string} ip - IP address to check
 * @param {string[]} cidrs - Array of CIDR notations
 * @returns {boolean} True if IP is in any range
 */
export function isIPInRanges(ip, cidrs) {
  if (!Array.isArray(cidrs)) return false;
  return cidrs.some(cidr => isIPInCIDR(ip, cidr));
}

/**
 * Check if IP is private/local
 * @param {string} ip - IP address to check
 * @returns {boolean} True if private IP
 */
export function isPrivateIP(ip) {
  if (!isValidIP(ip)) return false;

  const privateRanges = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '0.0.0.0/8'
  ];

  return isIPInRanges(ip, privateRanges);
}

/**
 * Check if IP is in disallow list
 * @param {string} ip - IP address to check
 * @param {Object} options - Options
 * @param {string[]} options.disallowList - Array of blocked IPs or CIDR ranges
 * @param {boolean} options.blockPrivateIPs - Whether to block private IPs
 * @returns {boolean} True if IP is disallowed
 */
export function isDisallowedIP(ip, options = {}) {
  const { disallowList = [], blockPrivateIPs = false } = options;

  if (!isValidIP(ip)) return true;

  // Check private IP blocking
  if (blockPrivateIPs && isPrivateIP(ip)) {
    return true;
  }

  // Check disallow list
  for (const blocked of disallowList) {
    // Exact match
    if (blocked === ip) return true;

    // CIDR range
    if (blocked.includes('/')) {
      if (isIPInCIDR(ip, blocked)) return true;
    }

    // Wildcard pattern (e.g., "192.168.1.*")
    if (blocked.includes('*')) {
      const pattern = blocked.replace(/\./g, '\\.').replace(/\*/g, '\\d+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(ip)) return true;
    }
  }

  return false;
}

/**
 * Get region info from IP using external API
 * @param {string} ip - IP address
 * @param {Object} options - Options
 * @param {string} options.apiUrl - Custom API URL (default: ipapi.co)
 * @param {boolean} options.useCache - Whether to use cache
 * @returns {Promise<Object>} Region information
 */
export async function getIPRegion(ip, options = {}) {
  const { apiUrl = 'https://ipapi.co', useCache = true } = options;

  if (!isValidIP(ip) || isPrivateIP(ip)) {
    return {
      ip,
      country: 'Unknown',
      country_code: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0
    };
  }

  // Check cache
  if (useCache && regionCache.has(ip)) {
    const cached = regionCache.get(ip);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    regionCache.delete(ip);
  }

  try {
    const response = await fetch(`${apiUrl}/${ip}/json/`, {
      headers: { 'User-Agent': 'Waline-EdgeOne' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const regionInfo = {
      ip: data.ip || ip,
      country: data.country_name || data.country || 'Unknown',
      country_code: data.country_code || 'XX',
      region: data.region || data.state || 'Unknown',
      city: data.city || 'Unknown',
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      timezone: data.timezone || 'UTC',
      isp: data.org || data.isp || 'Unknown'
    };

    // Cache the result
    if (useCache) {
      regionCache.set(ip, {
        data: regionInfo,
        timestamp: Date.now()
      });
    }

    return regionInfo;
  } catch (error) {
    // Return default on error
    return {
      ip,
      country: 'Unknown',
      country_code: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      error: error.message
    };
  }
}

/**
 * Get country code from IP
 * @param {string} ip - IP address
 * @returns {Promise<string>} Country code (ISO 3166-1 alpha-2)
 */
export async function getCountryCode(ip) {
  const region = await getIPRegion(ip);
  return region.country_code;
}

/**
 * Check IP QPS (Queries Per Second) rate limiting
 * @param {string} ip - IP address
 * @param {Object} options - Rate limiting options
 * @param {number} options.maxRequests - Maximum requests allowed
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Object} Rate limit status
 */
export function checkIPQPS(ip, options = {}) {
  const {
    maxRequests = 60,
    windowMs = 60000 // 1 minute
  } = options;

  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create request log for IP
  let requests = ipRequestLog.get(ip) || [];

  // Filter requests within the time window
  requests = requests.filter(timestamp => timestamp > windowStart);

  // Check if limit exceeded
  const currentCount = requests.length;
  const isAllowed = currentCount < maxRequests;

  // Add current request timestamp if allowed
  if (isAllowed) {
    requests.push(now);
  }

  // Update log
  ipRequestLog.set(ip, requests);

  // Calculate retry after
  const retryAfter = isAllowed ? 0 : Math.ceil((requests[0] + windowMs - now) / 1000);

  // Cleanup old entries periodically (every 1000 checks)
  if (Math.random() < 0.001) {
    cleanupRequestLog();
  }

  return {
    allowed: isAllowed,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - currentCount - (isAllowed ? 1 : 0)),
    resetTime: requests[0] ? requests[0] + windowMs : now + windowMs,
    retryAfter
  };
}

/**
 * Check if IP is rate limited
 * @param {string} ip - IP address
 * @param {Object} options - Rate limiting options
 * @returns {boolean} True if rate limited
 */
export function isRateLimited(ip, options = {}) {
  const result = checkIPQPS(ip, options);
  return !result.allowed;
}

/**
 * Get rate limit headers for response
 * @param {string} ip - IP address
 * @param {Object} options - Rate limiting options
 * @returns {Object} Headers object
 */
export function getRateLimitHeaders(ip, options = {}) {
  const result = checkIPQPS(ip, options);

  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    ...(result.retryAfter > 0 ? { 'Retry-After': String(result.retryAfter) } : {})
  };
}

/**
 * Reset rate limit for an IP
 * @param {string} ip - IP address
 */
export function resetRateLimit(ip) {
  ipRequestLog.delete(ip);
}

/**
 * Clean up old request log entries
 */
function cleanupRequestLog() {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour

  for (const [ip, requests] of ipRequestLog.entries()) {
    const recentRequests = requests.filter(ts => now - ts < maxAge);
    if (recentRequests.length === 0) {
      ipRequestLog.delete(ip);
    } else {
      ipRequestLog.set(ip, recentRequests);
    }
  }
}

/**
 * Create IP-based rate limiter middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Middleware function
 */
export function createIPRateLimiter(options = {}) {
  return function rateLimitMiddleware(request) {
    const ip = getClientIP(request);
    const result = checkIPQPS(ip, options);

    if (!result.allowed) {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      error.headers = getRateLimitHeaders(ip, options);
      throw error;
    }

    return {
      rateLimit: result,
      headers: getRateLimitHeaders(ip, options)
    };
  };
}

/**
 * Parse IP allowlist/disallowlist from string
 * @param {string} listString - Comma-separated list of IPs/CIDRs
 * @returns {string[]} Array of IPs/CIDRs
 */
export function parseIPList(listString) {
  if (!listString || typeof listString !== 'string') return [];

  return listString
    .split(/[,\n]/)
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0 && !ip.startsWith('#'));
}

/**
 * Get IP reputation score (placeholder for integration with reputation services)
 * @param {string} ip - IP address
 * @returns {Promise<number>} Reputation score (0-100, higher is worse)
 */
export async function getIPReputation(ip) {
  // Placeholder for integration with services like:
  // - AbuseIPDB
  - Project Honey Pot
  // - Custom reputation database

  if (!isValidIP(ip)) return 100;
  if (isPrivateIP(ip)) return 0;

  // Default: neutral score
  return 50;
}

/**
 * Check if IP should be blocked based on reputation
 * @param {string} ip - IP address
 * @param {number} threshold - Block threshold (0-100)
 * @returns {Promise<boolean>} True if should block
 */
export async function shouldBlockByReputation(ip, threshold = 80) {
  const score = await getIPReputation(ip);
  return score >= threshold;
}
