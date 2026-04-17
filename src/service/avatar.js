/**
 * Avatar Service for Waline
 * Supports: Gravatar, Avatar Proxy, Default Avatars
 */

const crypto = require('crypto');

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
 * Generate MD5 hash of email
 * @param {string} email - Email address
 * @returns {string} MD5 hash
 */
function getEmailHash(email) {
  if (!email) return '';
  return crypto
    .createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex');
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

  const hash = getEmailHash(email);
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
    const cacheKey = `avatar:${getEmailHash(url)}`;

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
      return this.getDefaultAvatarResponse(options.size || this.config.defaultSize);
    }
  }

  /**
   * Get default avatar response
   * @param {number} size - Avatar size
   * @returns {Response} Default avatar response
   */
  getDefaultAvatarResponse(size = 80) {
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
  const hash = getEmailHash(seed || 'default');
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

module.exports = {
  getEmailHash,
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
