/**
 * Avatar Service for Waline
 * Supports: Gravatar, Avatar Proxy, Default Avatars
 * EdgeOne Pages Functions compatible - uses Web Crypto API instead of Node.js crypto
 */

// Gravatar configuration
const GRAVATAR_CONFIG = {
  url: 'https://gravatar.com/avatar',
  params: {
    size: 's',
    default: 'd',
    rating: 'r',
    forcedefault: 'f'
  }
};

// Default avatar types matching official Waline behavior
const DEFAULT_AVATARS = {
  // Gravatar defaults
  '404': '404',           // Return 404 if no image
  'mp': 'mp',             // Mystery person
  'identicon': 'identicon', // Geometric pattern
  'monsterid': 'monsterid', // Monster face
  'wavatar': 'wavatar',   // Cartoon face
  'retro': 'retro',       // 8-bit arcade face
  'robohash': 'robohash', // Robot face
  'blank': 'blank',       // Transparent PNG

  // Custom defaults
  'mm': 'mp',             // Alias for mp (mystery man)
  'mystery': 'mp',
  'geometric': 'identicon',
  'monster': 'monsterid',
  'cartoon': 'wavatar',
  'pixel': 'retro',
  'robot': 'robohash'
};

// Avatar rating levels
const AVATAR_RATINGS = {
  'g': 'g',    // Suitable for all audiences
  'pg': 'pg',  // May contain rude gestures, provocatively dressed individuals
  'r': 'r',    // May contain such things as harsh profanity, intense violence
  'x': 'x'     // May contain hardcore sexual imagery or extremely disturbing violence
};

// Built-in avatar providers
const AVATAR_PROVIDERS = {
  gravatar: {
    name: 'Gravatar',
    url: 'https://gravatar.com/avatar',
    supportsSize: true,
    supportsDefault: true,
    supportsRating: true
  },
  cravatar: {
    name: 'Cravatar (China)',
    url: 'https://cravatar.cn/avatar',
    supportsSize: true,
    supportsDefault: true,
    supportsRating: true
  },
  loli: {
    name: 'Loli Gravatar',
    url: 'https://gravatar.loli.net/avatar',
    supportsSize: true,
    supportsDefault: true,
    supportsRating: true
  },
  v2ex: {
    name: 'V2EX Gravatar',
    url: 'https://cdn.v2ex.com/gravatar',
    supportsSize: true,
    supportsDefault: true,
    supportsRating: false
  },
  weavatar: {
    name: 'WeAvatar',
    url: 'https://weavatar.com/avatar',
    supportsSize: true,
    supportsDefault: true,
    supportsRating: true
  },
  qq: {
    name: 'QQ Avatar',
    url: 'https://q1.qlogo.cn/g',
    supportsSize: true,
    supportsDefault: false,
    supportsRating: false
  }
};

/**
 * Generate MD5 hash of email using Web Crypto API
 * @param {string} email - Email address
 * @returns {Promise<string>} MD5 hash
 */
async function getEmailHash(email) {
  if (!email) return '';

  const normalizedEmail = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedEmail);

  // Use Web Crypto API for MD5
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Generate MD5 hash synchronously (fallback using simple implementation)
 * @param {string} email - Email address
 * @returns {string} MD5 hash
 */
function getEmailHashSync(email) {
  if (!email) return '';

  const normalizedEmail = email.toLowerCase().trim();

  // Simple MD5 implementation for synchronous use
  // Based on RFC 1321
  function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }

    function addUnsigned(lX, lY) {
      const lX8 = (lX & 0x80000000);
      const lY8 = (lY & 0x80000000);
      const lX4 = (lX & 0x40000000);
      const lY4 = (lY & 0x40000000);
      const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
      return (lResult ^ lX8 ^ lY8);
    }

    function f(x, y, z) { return (x & y) | ((~x) & z); }
    function g(x, y, z) { return (x & z) | (y & (~z)); }
    function h(x, y, z) { return (x ^ y ^ z); }
    function i(x, y, z) { return (y ^ (x | (~z))); }

    function ff(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function gg(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function hh(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function ii(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(string) {
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
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }

    function wordToHex(lValue) {
      let wordToHexValue = '',
        wordToHexValueTemp = '',
        lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        wordToHexValueTemp = '0' + lByte.toString(16);
        wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
      }
      return wordToHexValue;
    }

    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = ff(a, b, c, d, x[k + 0], S11, 0xD76AA478);
      d = ff(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = ff(c, d, a, b, x[k + 2], S13, 0x242070DB);
      b = ff(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = ff(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
      d = ff(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = ff(c, d, a, b, x[k + 6], S13, 0xA8304613);
      b = ff(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = ff(a, b, c, d, x[k + 8], S11, 0x698098D8);
      d = ff(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = ff(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
      b = ff(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = ff(a, b, c, d, x[k + 12], S11, 0x6B901122);
      d = ff(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = ff(c, d, a, b, x[k + 14], S13, 0xA679438E);
      b = ff(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = gg(a, b, c, d, x[k + 1], S21, 0xF61E2562);
      d = gg(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = gg(c, d, a, b, x[k + 11], S23, 0x265E5A51);
      b = gg(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = gg(a, b, c, d, x[k + 5], S21, 0xD62F105D);
      d = gg(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = gg(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
      b = gg(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = gg(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
      d = gg(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = gg(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
      b = gg(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = gg(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
      d = gg(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = gg(c, d, a, b, x[k + 7], S23, 0x676F02D9);
      b = gg(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = hh(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
      d = hh(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = hh(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
      b = hh(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = hh(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
      d = hh(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
      c = hh(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
      b = hh(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
      a = hh(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
      d = hh(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
      c = hh(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
      b = hh(b, c, d, a, x[k + 6], S34, 0x4881D05);
      a = hh(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
      d = hh(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
      c = hh(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
      b = hh(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
      a = ii(a, b, c, d, x[k + 0], S41, 0xF4292244);
      d = ii(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = ii(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
      b = ii(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = ii(a, b, c, d, x[k + 12], S41, 0x655B59C3);
      d = ii(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = ii(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
      b = ii(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = ii(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
      d = ii(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = ii(c, d, a, b, x[k + 6], S43, 0xA3014314);
      b = ii(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = ii(a, b, c, d, x[k + 4], S41, 0xF7537E82);
      d = ii(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = ii(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
      b = ii(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }

    const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
    return temp.toLowerCase();
  }

  return md5(normalizedEmail);
}

/**
 * Get Gravatar URL
 * @param {string} email - Email address
 * @param {object} options - Options
 * @returns {string} Gravatar URL
 */
function getGravatarUrl(email, options = {}) {
  const {
    size = 80,
    default: defaultAvatar = 'mp',
    rating = 'g',
    forcedefault = false,
    provider = 'gravatar'
  } = options;

  const hash = getEmailHashSync(email);
  if (!hash) {
    return getDefaultAvatarUrl(defaultAvatar, size);
  }

  const providerConfig = AVATAR_PROVIDERS[provider] || AVATAR_PROVIDERS.gravatar;
  const params = new URLSearchParams();

  // Add size parameter
  if (providerConfig.supportsSize && size) {
    params.append(GRAVATAR_CONFIG.params.size, size);
  }

  // Add default avatar parameter
  if (providerConfig.supportsDefault) {
    const defaultValue = DEFAULT_AVATARS[defaultAvatar] || defaultAvatar;
    params.append(GRAVATAR_CONFIG.params.default, defaultValue);
  }

  // Add rating parameter
  if (providerConfig.supportsRating && rating) {
    const ratingValue = AVATAR_RATINGS[rating] || 'g';
    params.append(GRAVATAR_CONFIG.params.rating, ratingValue);
  }

  // Add force default parameter
  if (forcedefault) {
    params.append(GRAVATAR_CONFIG.params.forcedefault, 'y');
  }

  const queryString = params.toString();
  return `${providerConfig.url}/${hash}${queryString ? '?' + queryString : ''}`;
}

/**
 * Get default avatar URL when no email is provided
 * @param {string} type - Default avatar type
 * @param {number} size - Avatar size
 * @returns {string} Default avatar URL
 */
function getDefaultAvatarUrl(type = 'mp', size = 80) {
  const defaultType = DEFAULT_AVATARS[type] || type;

  // Use Gravatar's default endpoint
  const params = new URLSearchParams();
  params.append('d', defaultType);
  params.append('s', size);
  params.append('f', 'y'); // Force default

  // Return a transparent pixel as base
  return `https://gravatar.com/avatar/00000000000000000000000000000000?${params.toString()}`;
}

/**
 * Get QQ avatar URL
 * @param {string} qq - QQ number
 * @param {number} size - Avatar size
 * @returns {string} QQ avatar URL
 */
function getQQAvatarUrl(qq, size = 100) {
  if (!qq || !/^\d+$/.test(qq)) {
    return getDefaultAvatarUrl('mp', size);
  }

  // QQ avatar API
  const validSize = [40, 100, 140, 640].find(s => s >= size) || 100;
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=${validSize}`;
}

/**
 * Get avatar URL based on email or QQ
 * @param {string} email - Email or QQ number
 * @param {object} options - Options
 * @returns {string} Avatar URL
 */
function getAvatarUrl(email, options = {}) {
  if (!email) {
    return getDefaultAvatarUrl(options.default, options.size);
  }

  // Check if it's a QQ number
  if (/^\d{5,11}$/.test(email)) {
    return getQQAvatarUrl(email, options.size);
  }

  // Check if it's a QQ email
  const qqMatch = email.match(/^(\d+)@qq\.com$/i);
  if (qqMatch && options.qqAvatar !== false) {
    return getQQAvatarUrl(qqMatch[1], options.size);
  }

  // Use Gravatar
  return getGravatarUrl(email, options);
}

/**
 * Avatar proxy service for caching and transforming avatars
 * Useful for EdgeOne/Worker environments
 */
class AvatarProxy {
  constructor(config = {}) {
    this.config = {
      cacheDuration: config.cacheDuration || 86400, // 24 hours
      defaultSize: config.defaultSize || 80,
      defaultAvatar: config.defaultAvatar || 'mp',
      allowedOrigins: config.allowedOrigins || ['gravatar.com', 'cravatar.cn'],
      ...config
    };
  }

  /**
   * Generate proxy URL for avatar
   * @param {string} sourceUrl - Original avatar URL
   * @param {object} options - Transform options
   * @returns {string} Proxy URL
   */
  getProxyUrl(sourceUrl, options = {}) {
    if (!sourceUrl) {
      return getDefaultAvatarUrl(this.config.defaultAvatar, options.size || this.config.defaultSize);
    }

    // If it's already a data URL, return as-is
    if (sourceUrl.startsWith('data:')) {
      return sourceUrl;
    }

    // Parse the source URL
    let url;
    try {
      url = new URL(sourceUrl);
    } catch {
      return getDefaultAvatarUrl(this.config.defaultAvatar, options.size || this.config.defaultSize);
    }

    // Check if origin is allowed
    const isAllowed = this.config.allowedOrigins.some(origin =>
      url.hostname.includes(origin)
    );

    if (!isAllowed) {
      return getDefaultAvatarUrl(this.config.defaultAvatar, options.size || this.config.defaultSize);
    }

    // Add size parameter if specified
    if (options.size && !url.searchParams.has('s')) {
      url.searchParams.set('s', options.size);
    }

    return url.toString();
  }

  /**
   * Fetch avatar with caching
   * @param {string} url - Avatar URL
   * @param {object} env - Environment (for KV/cache access)
   * @returns {Promise<Response>} Avatar response
   */
  async fetchAvatar(url, env = {}) {
    const cacheKey = `avatar:${getEmailHashSync(url)}`;

    // Try to get from cache
    if (env.AVATAR_CACHE) {
      const cached = await env.AVATAR_CACHE.get(cacheKey, { type: 'arrayBuffer' });
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': `public, max-age=${this.config.cacheDuration}`
          }
        });
      }
    }

    // Fetch from source
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch avatar: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || 'image/png';
      const buffer = await response.arrayBuffer();

      // Store in cache
      if (env.AVATAR_CACHE) {
        await env.AVATAR_CACHE.put(cacheKey, buffer, {
          expirationTtl: this.config.cacheDuration
        });
      }

      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${this.config.cacheDuration}`
        }
      });
    } catch (error) {
      console.error('Avatar fetch error:', error);
      // Return default avatar
      return this.getDefaultAvatarResponse(this.config.defaultSize);
    }
  }

  /**
   * Get default avatar response
   * @param {number} size - Avatar size
   * @returns {Promise<Response>} Default avatar response
   */
  async getDefaultAvatarResponse(size = 80) {
    const defaultUrl = getDefaultAvatarUrl(this.config.defaultAvatar, size);
    return fetch(defaultUrl);
  }
}

/**
 * Generate SVG avatar (identicon-style)
 * @param {string} seed - Seed string
 * @param {number} size - Avatar size
 * @returns {string} SVG string
 */
function generateSvgAvatar(seed, size = 80) {
  const hash = getEmailHashSync(seed || 'default');
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ];

  // Use hash to determine color and pattern
  const colorIndex = parseInt(hash.substring(0, 2), 16) % colors.length;
  const color = colors[colorIndex];
  const bgColor = '#f3f4f6';

  // Generate a simple pattern based on hash
  const cells = 5;
  const cellSize = size / cells;
  let rects = '';

  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < Math.ceil(cells / 2); j++) {
      const hashIndex = (i * Math.ceil(cells / 2) + j) % 15;
      const bit = parseInt(hash[hashIndex], 16) % 2;

      if (bit === 1) {
        // Left side
        rects += `<rect x="${j * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
        // Mirror to right side
        if (j < cells / 2) {
          rects += `<rect x="${(cells - 1 - j) * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bgColor}"/>
    ${rects}
  </svg>`;
}

/**
 * Get avatar with fallback chain
 * Tries multiple sources in order
 * @param {string} email - Email address
 * @param {object} options - Options
 * @returns {Promise<string>} Avatar URL
 */
async function getAvatarWithFallback(email, options = {}) {
  const sources = options.sources || ['gravatar', 'qq', 'default'];

  for (const source of sources) {
    let url;

    switch (source) {
      case 'gravatar':
        url = getGravatarUrl(email, { ...options, provider: 'gravatar' });
        break;
      case 'cravatar':
        url = getGravatarUrl(email, { ...options, provider: 'cravatar' });
        break;
      case 'loli':
        url = getGravatarUrl(email, { ...options, provider: 'loli' });
        break;
      case 'v2ex':
        url = getGravatarUrl(email, { ...options, provider: 'v2ex' });
        break;
      case 'weavatar':
        url = getGravatarUrl(email, { ...options, provider: 'weavatar' });
        break;
      case 'qq':
        if (/^\d+$/.test(email) || email.includes('@qq.com')) {
          const qq = email.match(/^(\d+)/)?.[1] || email;
          url = getQQAvatarUrl(qq, options.size);
        }
        break;
      case 'default':
        url = getDefaultAvatarUrl(options.default, options.size);
        break;
      default:
        continue;
    }

    if (url) {
      // Try to verify the avatar exists
      if (options.verify !== false) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            return url;
          }
        } catch {
          // Continue to next source
          continue;
        }
      } else {
        return url;
      }
    }
  }

  return getDefaultAvatarUrl(options.default, options.size);
}

/**
 * Parse avatar size from string or number
 * @param {string|number} size - Size value
 * @param {number} defaultSize - Default size
 * @returns {number} Parsed size
 */
function parseAvatarSize(size, defaultSize = 80) {
  if (!size) return defaultSize;

  const parsed = parseInt(size, 10);
  if (isNaN(parsed) || parsed < 1) return defaultSize;

  // Clamp to reasonable range
  return Math.min(Math.max(parsed, 1), 2048);
}

/**
 * Build avatar URL for comment
 * Matches official Waline behavior
 * @param {object} comment - Comment object
 * @param {object} config - Avatar configuration
 * @returns {string} Avatar URL
 */
function getCommentAvatar(comment, config = {}) {
  const {
    size = 80,
    default: defaultAvatar = 'mp',
    rating = 'g',
    provider = 'gravatar',
    qqAvatar = true
  } = config;

  // Use provided avatar if available
  if (comment.avatar) {
    return comment.avatar;
  }

  // Try email first
  if (comment.mail) {
    return getAvatarUrl(comment.mail, {
      size,
      default: defaultAvatar,
      rating,
      provider,
      qqAvatar
    });
  }

  // Try link (might contain QQ)
  if (comment.link) {
    const qqMatch = comment.link.match(/qq\.com\/[^\d]*(\d{5,11})/);
    if (qqMatch) {
      return getQQAvatarUrl(qqMatch[1], size);
    }
  }

  // Return default
  return getDefaultAvatarUrl(defaultAvatar, size);
}

export {
  getEmailHash,
  getEmailHashSync,
  getGravatarUrl,
  getQQAvatarUrl,
  getAvatarUrl,
  getDefaultAvatarUrl,
  getAvatarWithFallback,
  getCommentAvatar,
  generateSvgAvatar,
  parseAvatarSize,
  AvatarProxy,
  DEFAULT_AVATARS,
  AVATAR_RATINGS,
  AVATAR_PROVIDERS
};
