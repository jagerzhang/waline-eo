/**
 * General helper utilities for Waline EdgeOne
 * Pure functions for ID generation, formatting, hashing, and utilities
 * Compatible with EdgeOne/Cloudflare Workers environment
 */

// ID counter for time-based IDs
let idCounter = 0;
let lastTimestamp = 0;

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now();

  // Reset counter if timestamp changed
  if (timestamp !== lastTimestamp) {
    idCounter = 0;
    lastTimestamp = timestamp;
  }

  // Increment counter
  idCounter = (idCounter + 1) % 10000;

  // Generate random component
  const random = Math.floor(Math.random() * 10000).toString(36).padStart(4, '0');

  // Combine components
  const id = `${timestamp.toString(36)}${idCounter.toString(36).padStart(2, '0')}${random}`;

  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate a short ID (8 characters)
 * @returns {string} Short unique ID
 */
export function generateShortId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Generate a UUID v4
 * @returns {string} UUID v4 string
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a nanoid-like ID
 * @param {number} size - ID length (default: 21)
 * @returns {string} Nano ID
 */
export function nanoid(size = 21) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  const bytes = new Uint8Array(size);

  // Use crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < size; i++) {
      id += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    // Fallback to Math.random
    for (let i = 0; i < size; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }

  return id;
}

/**
 * Format date to ISO string
 * @param {Date|number|string} date - Date to format
 * @returns {string} ISO 8601 formatted date
 */
export function formatDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/**
 * Format date to locale string
 * @param {Date|number|string} date - Date to format
 * @param {string} locale - Locale string (default: 'en-US')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDateLocale(date, locale = 'en-US', options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return d.toLocaleString(locale, defaultOptions);
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 * @param {Date|number|string} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin < 2) return 'a minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour < 2) return 'an hour ago';
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay < 2) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  if (diffMonth < 2) return 'a month ago';
  if (diffMonth < 12) return `${diffMonth} months ago`;
  if (diffYear < 2) return 'a year ago';
  return `${diffYear} years ago`;
}

/**
 * Format number with locale
 * @param {number} num - Number to format
 * @param {string} locale - Locale string
 * @returns {string} Formatted number
 */
export function formatNumber(num, locale = 'en-US') {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return num.toLocaleString(locale);
}

/**
 * Hash a string using SHA-256
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashString(str) {
  if (typeof str !== 'string') str = String(str);

  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using MD5 (for compatibility, not recommended for security)
 * @param {string} str - String to hash
 * @returns {string} MD5 hash
 */
export function md5(str) {
  if (typeof str !== 'string') str = String(str);

  // Simple MD5 implementation
  const utf8Encode = (string) => {
    return unescape(encodeURIComponent(string));
  };

  const rotateLeft = (lValue, iShiftBits) => {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  };

  const addUnsigned = (lX, lY) => {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);

    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  };

  const f = (x, y, z) => (x & y) | (~x & z);
  const g = (x, y, z) => (x & z) | (y & ~z);
  const h = (x, y, z) => x ^ y ^ z;
  const i = (x, y, z) => y ^ (x | ~z);

  const ff = (a, b, c, d, x, s, ac) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };

  const gg = (a, b, c, d, x, s, ac) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };

  const hh = (a, b, c, d, x, s, ac) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };

  const ii = (a, b, c, d, x, s, ac) => {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  };

  const convertToWordArray = (string) => {
    let lWordCount;
    const lMessageLength = string.length;
    const lNumberOfWordsTemp1 = lMessageLength + 8;
    const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
    const lWordArray = new Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;

    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }

    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;

    return lWordArray;
  };

  const wordToHex = (lValue) => {
    let wordToHexValue = '';
    let wordToHexValueTemp = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      wordToHexValueTemp = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = '0' + wordToHexValueTemp.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
    }
    return wordToHexValue;
  };

  const x = convertToWordArray(utf8Encode(str));
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a;
    const BB = b;
    const CC = c;
    const DD = d;

    a = ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
    d = ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
    b = ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
    c = ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
    b = ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
    d = ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
    d = ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
    c = ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
    b = ff(b, c, d, a, x[k + 15], 22, 0x49B40821);

    a = gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
    d = gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
    c = gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
    b = gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
    d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
    c = gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
    b = gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);

    a = hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
    c = hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, x[k + 6], 23, 0x4881D05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);

    a = ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
    d = ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
    c = ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
    d = ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
    b = ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
    d = ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  const result = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  return result.toLowerCase();
}

/**
 * Simple hash function (non-cryptographic)
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(item => deepClone(item));

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Deep merge objects
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
export function deepMerge(...objects) {
  const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (isObject(pVal) && isObject(oVal)) {
        prev[key] = deepMerge(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}

/**
 * Pick specific keys from an object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {Object} Object with only picked keys
 */
export function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {Object} Object without omitted keys
 */
export function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Check if value is empty (null, undefined, empty string/array/object)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is a plain object
 * @param {any} value - Value to check
 * @returns {boolean} True if plain object
 */
export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Group array items by key
 * @param {Array} array - Array to group
 * @param {string|Function} key - Key to group by
 * @returns {Object} Grouped object
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}

/**
 * Remove duplicates from array
 * @param {Array} array - Array to deduplicate
 * @param {string|Function} key - Optional key function for object comparison
 * @returns {Array} Deduplicated array
 */
export function uniq(array, key) {
  if (!key) return [...new Set(array)];

  const seen = new Set();
  return array.filter(item => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
export function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Flatten nested arrays
 * @param {Array} array - Array to flatten
 * @param {number} depth - Maximum depth to flatten
 * @returns {Array} Flattened array
 */
export function flatten(array, depth = 1) {
  return array.flat(depth);
}

/**
 * Create a success response object
 * @param {any} data - Response data
 * @param {Object} meta - Optional metadata
 * @returns {Object} Success response
 */
export function success(data, meta = {}) {
  return {
    success: true,
    data,
    ...meta
  };
}

/**
 * Create an error response object
 * @param {string} message - Error message
 * @param {number} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} Error response
 */
export function error(message, code = 500, details = {}) {
  return {
    success: false,
    error: {
      message,
      code,
      ...details
    }
  };
}

/**
 * Create a paginated response
 * @param {Array} data - Page data
 * @param {Object} pagination - Pagination info
 * @param {number} pagination.page - Current page
 * @param {number} pagination.pageSize - Items per page
 * @param {number} pagination.total - Total items
 * @returns {Object} Paginated response
 */
export function paginated(data, { page = 1, pageSize = 20, total = 0 }) {
  const totalPages = Math.ceil(total / pageSize);

  return success(data, {
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

/**
 * Create JSON response for Workers
 * @param {any} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} headers - Additional headers
 * @returns {Response} JSON Response object
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Create error response for Workers
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} Error Response object
 */
export function errorResponse(message, status = 500) {
  return jsonResponse(error(message, status), status);
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated string
 */
export function truncate(str, length, suffix = '...') {
  if (!str || str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Convert string to slug
 * @param {string} str - String to convert
 * @returns {string} Slug string
 */
export function slugify(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse query string to object
 * @param {string} queryString - Query string
 * @returns {Object} Parsed query object
 */
export function parseQuery(queryString) {
  if (!queryString) return {};

  const query = {};
  const params = new URLSearchParams(queryString);

  for (const [key, value] of params) {
    // Handle array values
    if (key in query) {
      if (!Array.isArray(query[key])) {
        query[key] = [query[key]];
      }
      query[key].push(value);
    } else {
      query[key] = value;
    }
  }

  return query;
}

/**
 * Build query string from object
 * @param {Object} params - Query parameters
 * @returns {string} Query string
 */
export function buildQuery(params) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, String(v));
      }
    } else {
      searchParams.append(key, String(value));
    }
  }

  return searchParams.toString();
}

/**
 * Sleep/delay for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts
 * @param {number} options.delay - Initial delay in ms
 * @param {number} options.maxDelay - Maximum delay in ms
 * @returns {Promise<any>} Function result
 */
export async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    maxDelay = 10000
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      const backoffDelay = Math.min(delay * Math.pow(2, attempt), maxDelay);
      await sleep(backoffDelay);
    }
  }

  throw lastError;
}

/**
 * Memoize a function
 * @param {Function} fn - Function to memoize
 * @param {Function} keyFn - Function to generate cache key
 * @returns {Function} Memoized function
 */
export function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();

  return function (...args) {
    const key = keyFn(...args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    return result;
  };
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
  let timeout;

  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
