/**
 * User Agent utilities for Waline EdgeOne
 * Pure functions for parsing and normalizing User-Agent strings
 * Compatible with EdgeOne/Cloudflare Workers environment
 */

// Browser detection patterns
const BROWSER_PATTERNS = [
  { name: 'Edge', regex: /Edg(?:e|A|iOS)?\/([0-9.]+)/ },
  { name: 'Chrome', regex: /Chrome\/([0-9.]+)/ },
  { name: 'Safari', regex: /Version\/([0-9.]+).*Safari\// },
  { name: 'Firefox', regex: /Firefox\/([0-9.]+)/ },
  { name: 'Opera', regex: /(?:Opera|OPR)\/([0-9.]+)/ },
  { name: 'Brave', regex: /Brave\/([0-9.]+)/ },
  { name: 'Vivaldi', regex: /Vivaldi\/([0-9.]+)/ },
  { name: 'Samsung', regex: /SamsungBrowser\/([0-9.]+)/ },
  { name: 'UC', regex: /UCBrowser\/([0-9.]+)/ },
  { name: 'QQ', regex: /QQBrowser\/([0-9.]+)/ },
  { name: 'WeChat', regex: /MicroMessenger\/([0-9.]+)/ },
  { name: 'IE', regex: /(?:MSIE |Trident.*rv:)([0-9.]+)/ }
];

// OS detection patterns
const OS_PATTERNS = [
  { name: 'Windows', regex: /Windows NT ([0-9.]+)/, versionMap: { '10.0': '10', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.2': 'XP', '5.1': 'XP' } },
  { name: 'macOS', regex: /Mac OS X ([0-9_]+)/, versionSeparator: '_' },
  { name: 'iOS', regex: /(?:iPhone|iPad|iPod).*OS ([0-9_]+)/, versionSeparator: '_' },
  { name: 'Android', regex: /Android ([0-9.]+)/ },
  { name: 'Linux', regex: /Linux/ },
  { name: 'Chrome OS', regex: /CrOS/ },
  { name: 'FreeBSD', regex: /FreeBSD/ },
  { name: 'OpenBSD', regex: /OpenBSD/ },
  { name: 'NetBSD', regex: /NetBSD/ }
];

// Device type detection patterns
const DEVICE_PATTERNS = [
  { type: 'tablet', regex: /(iPad|Tablet|PlayBook|Kindle|Silk)/i },
  { type: 'mobile', regex: /(iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Mobile)/i },
  { type: 'smarttv', regex: /(Smart-TV|SmartTV|AppleTV|HbbTV|NetCast|WebOS.+TV)/i },
  { type: 'console', regex: /(PlayStation|Xbox|Nintendo|Switch)/i },
  { type: 'wearable', regex: /(Watch|Glass)/i },
  { type: 'desktop', regex: /.*/ } // Fallback
];

// Bot detection patterns
const BOT_PATTERNS = [
  { name: 'Googlebot', regex: /Googlebot/ },
  { name: 'Bingbot', regex: /bingbot/ },
  { name: 'Slurp', regex: /Slurp/ },
  { name: 'DuckDuckBot', regex: /DuckDuckBot/ },
  { name: 'Baiduspider', regex: /Baiduspider/ },
  { name: 'YandexBot', regex: /YandexBot/ },
  { name: 'Sogou', regex: /Sogou/ },
  { name: 'facebook', regex: /facebookexternalhit/ },
  { name: 'Twitter', regex: /Twitterbot/ },
  { name: 'LinkedIn', regex: /LinkedInBot/ },
  { name: 'WhatsApp', regex: /WhatsApp/ },
  { name: 'Slack', regex: /Slackbot/ },
  { name: 'Discord', regex: /Discordbot/ },
  { name: 'Telegram', regex: /TelegramBot/ },
  { name: 'curl', regex: /curl/ },
  { name: 'wget', regex: /Wget/ },
  { name: 'Postman', regex: /Postman/ },
  { name: 'Insomnia', regex: /Insomnia/ }
];

/**
 * Parse User-Agent string
 * @param {string} userAgent - Raw User-Agent string
 * @returns {Object} Parsed UA information
 */
export function parse(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return getDefaultUAInfo();
  }

  const ua = userAgent.trim();

  return {
    browser: parseBrowser(ua),
    os: parseOS(ua),
    device: parseDevice(ua),
    isBot: isBot(ua),
    botInfo: parseBot(ua),
    raw: ua
  };
}

/**
 * Parse browser information from UA string
 * @param {string} ua - User-Agent string
 * @returns {Object} Browser info
 */
function parseBrowser(ua) {
  for (const pattern of BROWSER_PATTERNS) {
    const match = ua.match(pattern.regex);
    if (match) {
      return {
        name: pattern.name,
        version: match[1] || 'unknown',
        full: `${pattern.name} ${match[1] || ''}`.trim()
      };
    }
  }

  return {
    name: 'Unknown',
    version: 'unknown',
    full: 'Unknown'
  };
}

/**
 * Parse OS information from UA string
 * @param {string} ua - User-Agent string
 * @returns {Object} OS info
 */
function parseOS(ua) {
  for (const pattern of OS_PATTERNS) {
    const match = ua.match(pattern.regex);
    if (match) {
      let version = match[1] || '';

      // Apply version mapping if available
      if (pattern.versionMap && pattern.versionMap[version]) {
        version = pattern.versionMap[version];
      }

      // Replace underscores with dots for Apple OS versions
      if (pattern.versionSeparator) {
        version = version.replace(/_/g, pattern.versionSeparator);
      }

      return {
        name: pattern.name,
        version: version,
        full: `${pattern.name} ${version}`.trim()
      };
    }
  }

  return {
    name: 'Unknown',
    version: '',
    full: 'Unknown'
  };
}

/**
 * Parse device information from UA string
 * @param {string} ua - User-Agent string
 * @returns {Object} Device info
 */
function parseDevice(ua) {
  // Check for specific device models
  const deviceModel = extractDeviceModel(ua);

  // Determine device type
  let deviceType = 'desktop';
  for (const pattern of DEVICE_PATTERNS) {
    if (pattern.regex.test(ua)) {
      deviceType = pattern.type;
      break;
    }
  }

  // Check if mobile based on screen hints or touch capability hints
  const isMobile = deviceType === 'mobile' || deviceType === 'tablet';

  return {
    type: deviceType,
    model: deviceModel,
    vendor: extractVendor(ua),
    isMobile,
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTouch: isMobile || /Touch/.test(ua)
  };
}

/**
 * Extract device model from UA string
 * @param {string} ua - User-Agent string
 * @returns {string|null} Device model
 */
function extractDeviceModel(ua) {
  // iPhone model detection
  const iPhoneMatch = ua.match(/iPhone(?:\d+)?,?(\d+)/);
  if (iPhoneMatch) {
    return `iPhone ${iPhoneMatch[1]}`;
  }

  // iPad model detection
  if (/iPad/.test(ua)) {
    return 'iPad';
  }

  // Android device detection
  const androidMatch = ua.match(/Android[^;]*;\s*([^;)]+)/);
  if (androidMatch) {
    return androidMatch[1].trim();
  }

  // Samsung device detection
  const samsungMatch = ua.match(/Samsung(?:SGH|SCH|GT|SM)-([A-Za-z0-9]+)/);
  if (samsungMatch) {
    return `Samsung ${samsungMatch[1]}`;
  }

  return null;
}

/**
 * Extract vendor from UA string
 * @param {string} ua - User-Agent string
 * @returns {string|null} Vendor name
 */
function extractVendor(ua) {
  if (/iPhone|iPad|iPod|Mac/.test(ua)) return 'Apple';
  if (/Samsung/.test(ua)) return 'Samsung';
  if (/Huawei/.test(ua)) return 'Huawei';
  if (/Xiaomi/.test(ua)) return 'Xiaomi';
  if (/OPPO/.test(ua)) return 'OPPO';
  if (/vivo/.test(ua)) return 'vivo';
  if (/OnePlus/.test(ua)) return 'OnePlus';
  if (/Google/.test(ua)) return 'Google';
  if (/Sony/.test(ua)) return 'Sony';
  if (/LG/.test(ua)) return 'LG';
  if (/HTC/.test(ua)) return 'HTC';
  if (/Nokia/.test(ua)) return 'Nokia';
  if (/Microsoft/.test(ua)) return 'Microsoft';

  return null;
}

/**
 * Check if UA is a bot
 * @param {string} ua - User-Agent string
 * @returns {boolean} True if bot
 */
export function isBot(ua) {
  if (!ua || typeof ua !== 'string') return false;

  return BOT_PATTERNS.some(pattern => pattern.regex.test(ua));
}

/**
 * Parse bot information from UA string
 * @param {string} ua - User-Agent string
 * @returns {Object|null} Bot info or null
 */
function parseBot(ua) {
  if (!isBot(ua)) return null;

  for (const pattern of BOT_PATTERNS) {
    if (pattern.regex.test(ua)) {
      return {
        name: pattern.name,
        isBot: true
      };
    }
  }

  return {
    name: 'Unknown Bot',
    isBot: true
  };
}

/**
 * Normalize UA string for consistent storage/comparison
 * @param {string} userAgent - Raw User-Agent string
 * @returns {string} Normalized UA string
 */
export function normalize(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'unknown';
  }

  let normalized = userAgent.trim();

  // Remove excessive whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  // Truncate to reasonable length
  const MAX_LENGTH = 512;
  if (normalized.length > MAX_LENGTH) {
    normalized = normalized.substring(0, MAX_LENGTH);
  }

  // Remove potentially harmful characters
  normalized = normalized.replace(/[<>\"']/g, '');

  return normalized;
}

/**
 * Get a short/summary version of UA for display
 * @param {string} userAgent - User-Agent string
 * @returns {string} Short UA summary
 */
export function getShortUA(userAgent) {
  const parsed = parse(userAgent);

  if (parsed.isBot) {
    return `Bot: ${parsed.botInfo.name}`;
  }

  const parts = [];
  if (parsed.browser.name !== 'Unknown') {
    parts.push(parsed.browser.name);
  }
  if (parsed.os.name !== 'Unknown') {
    parts.push(parsed.os.name);
  }
  if (parsed.device.isMobile) {
    parts.push('Mobile');
  }

  return parts.join(' / ') || 'Unknown';
}

/**
 * Get default UA info for empty/invalid UA
 * @returns {Object} Default UA info
 */
function getDefaultUAInfo() {
  return {
    browser: { name: 'Unknown', version: 'unknown', full: 'Unknown' },
    os: { name: 'Unknown', version: '', full: 'Unknown' },
    device: {
      type: 'unknown',
      model: null,
      vendor: null,
      isMobile: false,
      isTablet: false,
      isDesktop: false,
      isTouch: false
    },
    isBot: false,
    botInfo: null,
    raw: ''
  };
}

/**
 * Check if browser is modern/supported
 * @param {string} userAgent - User-Agent string
 * @returns {boolean} True if modern browser
 */
export function isModernBrowser(userAgent) {
  const parsed = parse(userAgent);
  const { browser, os } = parsed;

  // Block IE
  if (browser.name === 'IE') return false;

  // Check minimum versions
  const minVersions = {
    'Chrome': 60,
    'Firefox': 60,
    'Safari': 12,
    'Edge': 79,
    'Opera': 47
  };

  if (minVersions[browser.name]) {
    const majorVersion = parseInt(browser.version.split('.')[0], 10);
    return majorVersion >= minVersions[browser.name];
  }

  return true;
}

/**
 * Extract language from Accept-Language header
 * @param {string} acceptLanguage - Accept-Language header value
 * @returns {string} Primary language code
 */
export function getPrimaryLanguage(acceptLanguage) {
  if (!acceptLanguage || typeof acceptLanguage !== 'string') {
    return 'en';
  }

  // Parse language preferences
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, q = '1'] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        q: parseFloat(q) || 1
      };
    })
    .sort((a, b) => b.q - a.q);

  return languages[0]?.code || 'en';
}

/**
 * Create a fingerprint from UA and other client info
 * @param {Object} info - Client information
 * @param {string} info.userAgent - User-Agent string
 * @param {string} info.acceptLanguage - Accept-Language header
 * @param {string} info.acceptEncoding - Accept-Encoding header
 * @returns {string} Simple fingerprint hash
 */
export function createFingerprint(info) {
  const { userAgent = '', acceptLanguage = '', acceptEncoding = '' } = info;

  const data = `${normalize(userAgent)}|${getPrimaryLanguage(acceptLanguage)}|${acceptEncoding}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return hash.toString(16);
}

/**
 * Check if request is from a trusted proxy
 * @param {string} userAgent - User-Agent string
 * @returns {boolean} True if trusted proxy
 */
export function isTrustedProxy(userAgent) {
  if (!userAgent) return false;

  const trustedProxies = [
    'Cloudflare',
    'CloudFront',
    'Fastly',
    'Akamai',
    'MaxCDN',
    'KeyCDN'
  ];

  return trustedProxies.some(proxy =>
    userAgent.toLowerCase().includes(proxy.toLowerCase())
  );
}
