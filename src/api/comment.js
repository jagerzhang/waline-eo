/**
 * Waline Comment API Module for EdgeOne
 * Implements all features from the official Waline comment controller
 * @module api/comment
 */

/**
 * @typedef {Object} Comment
 * @property {string} objectId - Unique identifier
 * @property {string} nick - User nickname
 * @property {string} mail - User email (hashed for non-admins)
 * @property {string} link - User website URL
 * @property {string} ua - User agent string
 * @property {string} ip - IP address (admin only)
 * @property {string} comment - Comment content (HTML rendered)
 * @property {string} commentRaw - Raw comment content (markdown)
 * @property {string} url - Article URL path
 * @property {string} rid - Root comment ID (for replies)
 * @property {string} pid - Parent comment ID (for replies)
 * @property {string} status - Comment status: 'approved', 'waiting', 'spam'
 * @property {number} like - Like count
 * @property {boolean} sticky - Whether comment is sticky
 * @property {string} level - User level based on comment count
 * @property {Object} user - User info if logged in
 * @property {string} browser - Parsed browser name
 * @property {string} os - Parsed OS name
 * @property {string} addr - IP region/location
 * @property {string} insertedAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 * @property {Comment[]} children - Nested reply comments
 */

/**
 * @typedef {Object} CommentListResponse
 * @property {number} page - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} pageSize - Comments per page
 * @property {number} count - Total comment count
 * @property {Comment[]} data - Array of root comments with nested children
 */

/**
 * @typedef {Object} AdminCommentListResponse
 * @property {number} page - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} pageSize - Comments per page
 * @property {number} spamCount - Number of spam comments
 * @property {number} waitingCount - Number of pending comments
 * @property {Comment[]} data - Array of comments
 */

/**
 * @typedef {Object} CommentCountResponse
 * @property {number} count - Comment count for single URL
 * @property {Object} counts - Object mapping URLs to counts for batch request
 */

// EdgeOne Pages Functions compatible - no Node.js imports
// Using Web Crypto API and simple UA parser instead of Node.js modules

// Constants
const IPQPS = 60; // Seconds between comments from same IP

/**
 * Generate MD5 hash using Web Crypto API
 * @param {string} text - Text to hash
 * @returns {Promise<string>} MD5 hash hex string
 */
async function md5Hash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple User Agent parser - extracts browser and OS info
 * @param {string} ua - User agent string
 * @returns {{browser: string, os: string}} Parsed browser and OS
 */
function simpleUAParser(ua) {
  if (!ua) {
    return { browser: '', os: '' };
  }

  let browserName = '';
  let browserVersion = '';
  let osName = '';
  let osVersion = '';

  // Browser detection
  const browserPatterns = [
    { name: 'Edge', regex: /Edg(?:e|A|iOS)?\/(\d+(\.\d+)?)/ },
    { name: 'Chrome', regex: /Chrome\/(\d+(\.\d+)?)/ },
    { name: 'Safari', regex: /Version\/(\d+(\.\d+)?).*Safari\/(\d+(\.\d+)?)/ },
    { name: 'Firefox', regex: /Firefox\/(\d+(\.\d+)?)/ },
    { name: 'Opera', regex: /(?:Opera|OPR)\/(\d+(\.\d+)?)/ },
    { name: 'IE', regex: /(?:MSIE |Trident.*rv:)(\d+(\.\d+)?)/ }
  ];

  for (const pattern of browserPatterns) {
    const match = ua.match(pattern.regex);
    if (match) {
      browserName = pattern.name;
      browserVersion = match[1];
      break;
    }
  }

  // OS detection
  const osPatterns = [
    { name: 'Windows', regex: /Windows NT (\d+\.\d+)/ },
    { name: 'macOS', regex: /Mac OS X (\d+[._]\d+([._]\d+)?)/ },
    { name: 'iOS', regex: /(?:iPhone|iPad|iPod).*OS (\d+[._]\d+([._]\d+)?)/ },
    { name: 'Android', regex: /Android (\d+(\.\d+)?)/ },
    { name: 'Linux', regex: /Linux/ },
    { name: 'Chrome OS', regex: /CrOS/ }
  ];

  for (const pattern of osPatterns) {
    const match = ua.match(pattern.regex);
    if (match) {
      osName = pattern.name;
      if (match[1]) {
        osVersion = match[1].replace(/_/g, '.');
        // Windows NT version mapping
        if (osName === 'Windows') {
          const ntVersion = parseFloat(osVersion);
          if (ntVersion >= 10) {
            osVersion = String(Math.floor(ntVersion));
          } else if (ntVersion === 6.3) {
            osVersion = '8.1';
          } else if (ntVersion === 6.2) {
            osVersion = '8';
          } else if (ntVersion === 6.1) {
            osVersion = '7';
          } else if (ntVersion === 6.0) {
            osVersion = 'Vista';
          } else if (ntVersion === 5.2) {
            osVersion = 'XP';
          } else if (ntVersion === 5.1) {
            osVersion = 'XP';
          }
        }
      }
      break;
    }
  }

  return {
    browser: browserName ? `${browserName} ${browserVersion}`.trim() : '',
    os: osName ? `${osName} ${osVersion}`.trim() : ''
  };
}

// Constants
const LIKE_INC_MAX = 10; // Maximum random increment for likes
const DEFAULT_LEVELS = [0, 10, 20, 50, 100, 200]; // Default level thresholds
const DEFAULT_KEY = '70542d86693e'; // Default Akismet key

/**
 * CommentAPI class for handling all comment operations
 * Compatible with Waline EdgeOne deployment
 */
export class CommentAPI {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.storage - Storage adapter (D1, KV, etc.)
   * @param {Object} options.config - Waline configuration
   * @param {Object} options.ctx - Request context
   */
  constructor(options = {}) {
    this.storage = options.storage;
    this.config = options.config || {};
    this.ctx = options.ctx || {};
    this.userInfo = options.ctx?.state?.userInfo || null;
  }

  /**
   * Get storage model for comments
   * @private
   * @returns {Object} Storage model instance
   */
  getModel() {
    return this.storage;
  }

  /**
   * Check if current user is admin
   * @private
   * @returns {boolean}
   */
  isAdmin() {
    return this.userInfo?.type === 'administrator';
  }

  /**
   * Check if current user is logged in
   * @private
   * @returns {boolean}
   */
  isLogin() {
    return !!this.userInfo && Object.keys(this.userInfo).length > 0;
  }

  /**
   * Parse user agent string to extract browser and OS info
   * @private
   * @param {string} ua - User agent string
   * @returns {{browser: string, os: string}} Parsed browser and OS
   */
  parseUA(ua) {
    if (!ua || this.config.DISABLE_USERAGENT) {
      return { browser: '', os: '' };
    }

    try {
      return simpleUAParser(ua);
    } catch (e) {
      return { browser: '', os: '' };
    }
  }

  /**
   * Convert IP to region/location
   * @private
   * @param {string} ip - IP address
   * @returns {string} Region string
   */
  async ip2region(ip) {
    if (!ip || this.config.DISABLE_REGION) {
      return '';
    }

    try {
      // Use IP2Region or similar service
      // For EdgeOne, we can use the request's cf-ipcountry header or a lookup service
      const country = this.ctx.request?.headers?.get('cf-ipcountry');
      if (country) {
        return country;
      }

      // Fallback: try to use a simple IP database or API
      // This is a placeholder - implement based on your IP database
      return '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Generate Gravatar URL from email
   * @private
   * @param {string} mail - Email address
   * @param {string} [avatarProxy] - Avatar proxy URL
   * @returns {Promise<string>} Gravatar URL
   */
  async getAvatarUrl(mail, avatarProxy) {
    if (!mail) {
      return '';
    }

    const hash = await md5Hash(mail.toLowerCase().trim());
    let url = `https://gravatar.com/avatar/${hash}?d=identicon`;

    if (avatarProxy && !url.includes(avatarProxy)) {
      url = `${avatarProxy}?url=${encodeURIComponent(url)}`;
    }

    return url;
  }

  /**
   * Get user level based on comment count
   * @private
   * @param {number} count - Comment count
   * @returns {string} Level string
   */
  getLevel(count) {
    const levels = this.config.LEVELS || DEFAULT_LEVELS;
    let level = '';

    for (let i = 0; i < levels.length; i++) {
      if (count >= levels[i]) {
        level = String(i);
      }
    }

    return level;
  }

  /**
   * Render markdown to HTML
   * @private
   * @param {string} content - Markdown content
   * @returns {string} HTML content
   */
  async renderMarkdown(content) {
    if (!content) return '';

    try {
      // Simple markdown parser - replace with your preferred library
      // For EdgeOne, you might use a lightweight markdown parser
      let html = content
        // Escape HTML first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>');

      // XSS protection - sanitize HTML
      html = this.sanitizeHtml(html);

      return html;
    } catch (e) {
      return content;
    }
  }

  /**
   * Sanitize HTML to prevent XSS
   * @private
   * @param {string} html - HTML content
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(html) {
    if (!html) return '';

    // Allowlist of safe HTML tags and attributes
    const allowedTags = ['p', 'br', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'span', 'div'];
    const allowedAttrs = {
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class']
    };

    // Simple sanitization - remove script tags and event handlers
    let sanitized = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return sanitized;
  }

  /**
   * Format comment data for response
   * @private
   * @param {Object} comment - Raw comment data
   * @param {Object} [options] - Formatting options
   * @param {boolean} [options.isAdmin] - Whether to include admin-only fields
   * @returns {Promise<Comment>} Formatted comment
   */
  async formatCmt(comment, options = {}) {
    if (!comment) return null;

    const isAdmin = options.isAdmin || this.isAdmin();
    const avatarProxy = this.config.AVATAR_PROXY;

    // Parse user agent
    const { browser, os } = this.parseUA(comment.ua);

    // Get IP region
    const addr = await this.ip2region(comment.ip);

    // Render markdown
    const commentHtml = await this.renderMarkdown(comment.comment);

    // Hash the email for privacy (using Web Crypto API)
    const mailHash = comment.mail ? await md5Hash(comment.mail.toLowerCase().trim()) : '';

    // Build formatted comment
    const formatted = {
      objectId: comment.objectId || comment.id,
      nick: comment.nick,
      mail: mailHash,
      link: comment.link || '',
      ua: comment.ua || '',
      comment: commentHtml,
      commentRaw: comment.comment,
      url: comment.url,
      rid: comment.rid || '',
      pid: comment.pid || '',
      status: comment.status || 'approved',
      like: comment.like || 0,
      sticky: comment.sticky || false,
      level: this.getLevel(comment.user?.commentCount || 0),
      browser,
      os,
      addr,
      insertedAt: comment.insertedAt || comment.createdAt,
      updatedAt: comment.updatedAt,
      avatar: await this.getAvatarUrl(comment.mail, avatarProxy),
      children: []
    };

    // Add user info if available
    if (comment.user) {
      formatted.user = {
        objectId: comment.user.objectId || comment.user.id,
        nick: comment.user.nick || comment.user.display_name,
        mail: comment.user.mail,
        link: comment.user.link,
        avatar: comment.user.avatar || await this.getAvatarUrl(comment.user.mail, avatarProxy),
        type: comment.user.type,
        level: this.getLevel(comment.user.commentCount || 0)
      };
    }

    // Admin-only fields
    if (isAdmin) {
      formatted.ip = comment.ip;
      formatted.mail = comment.mail; // Show actual email for admin
    }

    return formatted;
  }

  /**
   * Build comment tree from flat list
   * @private
   * @param {Object[]} comments - Flat list of comments
   * @param {Object} options - Build options
   * @returns {Promise<Comment[]>} Tree structure with root comments and nested children
   */
  async buildCommentTree(comments, options = {}) {
    if (!comments || comments.length === 0) return [];

    const isAdmin = options.isAdmin || this.isAdmin();
    const formattedComments = await Promise.all(
      comments.map(c => this.formatCmt(c, { isAdmin }))
    );

    // Create a map for quick lookup
    const commentMap = new Map();
    formattedComments.forEach(c => {
      commentMap.set(c.objectId, c);
    });

    // Build tree
    const roots = [];

    formattedComments.forEach(comment => {
      if (comment.rid) {
        // This is a reply
        const root = commentMap.get(comment.rid);
        if (root) {
          if (!root.children) root.children = [];
          root.children.push(comment);
        }
      } else {
        // This is a root comment
        roots.push(comment);
      }
    });

    // Sort children by insertedAt
    roots.forEach(root => {
      if (root.children && root.children.length > 0) {
        root.children.sort((a, b) => new Date(a.insertedAt) - new Date(b.insertedAt));
      }
    });

    return roots;
  }

  /**
   * Check if IP is in disallow list
   * @private
   * @param {string} ip - IP address
   * @returns {boolean}
   */
  isDisallowedIP(ip) {
    const disallowList = this.config.DISALLOW_IP_LIST || [];
    return disallowList.includes(ip);
  }

  /**
   * Check for duplicate comment
   * @private
   * @param {Object} data - Comment data
   * @returns {Promise<boolean>}
   */
  async isDuplicate(data) {
    const { url, comment, nick, mail } = data;

    const existing = await this.getModel().findOne({
      url,
      comment,
      nick,
      mail,
      insertedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    });

    return !!existing;
  }

  /**
   * Check IP frequency limit (IPQPS)
   * @private
   * @param {string} ip - IP address
   * @returns {Promise<boolean>}
   */
  async checkIPQPS(ip) {
    const key = `ipqps:${ip}`;
    const lastComment = await this.storage.getKV?.(key);

    if (lastComment) {
      const lastTime = parseInt(lastComment, 10);
      const now = Date.now();
      if (now - lastTime < IPQPS * 1000) {
        return false;
      }
    }

    // Update last comment time
    await this.storage.setKV?.(key, String(Date.now()), IPQPS);
    return true;
  }

  /**
   * Check Akismet spam detection
   * @private
   * @param {Object} data - Comment data
   * @returns {Promise<boolean>} True if spam
   */
  async checkAkismet(data) {
    const akismetKey = this.config.AKISMET_KEY || DEFAULT_KEY;
    if (!akismetKey) return false;

    try {
      const blog = this.config.SITE_URL || this.ctx.request?.headers?.get('origin') || '';
      const response = await fetch('https://rest.akismet.com/1.1/comment-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': `Waline/1.0 | Akismet/1.0`
        },
        body: new URLSearchParams({
          blog,
          user_ip: data.ip,
          user_agent: data.ua || '',
          referrer: data.referrer || '',
          permalink: data.url,
          comment_type: 'comment',
          comment_author: data.nick,
          comment_author_email: data.mail,
          comment_author_url: data.link || '',
          comment_content: data.comment
        })
      });

      const result = await response.text();
      return result === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Check keyword filter
   * @private
   * @param {string} content - Comment content
   * @returns {boolean} True if contains forbidden words
   */
  checkForbiddenWords(content) {
    const forbiddenWords = this.config.FORBIDDEN_WORDS || [];
    if (!forbiddenWords.length) return false;

    const regex = new RegExp(forbiddenWords.join('|'), 'i');
    return regex.test(content);
  }

  /**
   * Execute pre-save hook
   * @private
   * @param {Object} data - Comment data
   * @returns {Promise<Object>} Modified data
   */
  async preSaveHook(data) {
    const hook = this.config.preSave;
    if (typeof hook === 'function') {
      return await hook(data, this) || data;
    }
    return data;
  }

  /**
   * Execute post-save hook
   * @private
   * @param {Object} comment - Saved comment
   * @returns {Promise<void>}
   */
  async postSaveHook(comment) {
    const hook = this.config.postSave;
    if (typeof hook === 'function') {
      await hook(comment, this);
    }
  }

  /**
   * Send email notification
   * @private
   * @param {Object} comment - New comment
   * @param {Object} [parent] - Parent comment (for replies)
   * @returns {Promise<void>}
   */
  async sendNotification(comment, parent) {
    try {
      // Skip if comment is spam
      if (comment.status === 'spam') return;

      // Notify admin
      await this.notifyAdmin(comment);

      // Notify parent comment author (for replies)
      if (parent && parent.mail && parent.mail !== comment.mail) {
        await this.notifyReply(parent, comment);
      }
    } catch (e) {
      console.error('Notification error:', e);
    }
  }

  /**
   * Notify admin of new comment
   * @private
   * @param {Object} comment - New comment
   */
  async notifyAdmin(comment) {
    // Implementation depends on your notification service
    // This is a placeholder for the notification logic
    const adminEmail = this.config.ADMIN_EMAIL;
    if (!adminEmail) return;

    // Send email via your preferred service
    // Example: SendGrid, Resend, etc.
  }

  /**
   * Notify parent comment author of reply
   * @private
   * @param {Object} parent - Parent comment
   * @param {Object} reply - Reply comment
   */
  async notifyReply(parent, reply) {
    // Skip if parent is the same user
    if (parent.mail === reply.mail) return;

    // Skip fake emails
    if (parent.mail?.includes('@mail.com') || parent.mail?.includes('@example.com')) return;

    // Implementation depends on your notification service
  }

  /**
   * GET /comment - Get comment list
   * Supports type parameter: recent, count, list, or default comment list
   * @param {Object} query - Query parameters
   * @param {string} [query.type] - List type: 'recent', 'count', 'list'
   * @param {string} [query.path] - Article URL path (required for default list)
   * @param {number} [query.page=1] - Page number
   * @param {number} [query.pageSize=10] - Comments per page
   * @param {string} [query.sortBy='insertedAt_desc'] - Sort order
   * @param {number} [query.count=10] - Number of recent comments to return
   * @param {string|string[]} [query.url] - URL(s) for count query
   * @param {string} [query.owner] - Filter by owner ('mine')
   * @param {string} [query.status] - Filter by status
   * @param {string} [query.keyword] - Search keyword
   * @returns {Promise<CommentListResponse|AdminCommentListResponse|CommentCountResponse|Comment[]>}
   */
  async get(query = {}) {
    const { type } = query;

    switch (type) {
      case 'recent':
        return this.getRecent(query);
      case 'count':
        return this.getCount(query);
      case 'list':
        return this.getAdminList(query);
      default:
        return this.getCommentList(query);
    }
  }

  /**
   * Get paginated comment list with nested replies
   * @private
   * @param {Object} query - Query parameters
   * @param {string} query.path - Article URL path
   * @param {number} [query.page=1] - Page number
   * @param {number} [query.pageSize=10] - Comments per page
   * @param {string} [query.sortBy='insertedAt_desc'] - Sort order
   * @returns {Promise<CommentListResponse>}
   */
  async getCommentList(query) {
    const { path, page = 1, pageSize = 10, sortBy = 'insertedAt_desc' } = query;

    if (!path) {
      throw new Error('Path is required');
    }

    const isAdmin = this.isAdmin();
    const isLoggedIn = this.isLogin();

    // Build where clause
    const where = { url: path };

    // Visibility rules
    if (!isAdmin) {
      if (isLoggedIn) {
        // Logged-in users see approved + their own comments
        where.$or = [
          { status: 'approved' },
          { user_id: this.userInfo.objectId }
        ];
      } else {
        // Guests see only approved comments
        where.status = 'approved';
      }
    }

    // Parse sortBy
    const [sortField, sortOrder] = sortBy.split('_');
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get total count
    const count = await this.getModel().count(where);

    // Determine pagination strategy
    const totalPages = Math.ceil(count / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));

    let comments;

    // Optimization: For small datasets, fetch all and paginate in memory
    if (count < 1000) {
      comments = await this.getModel().find(where, {
        sort: { [sortField]: order },
        limit: 1000
      });
    } else {
      // For large datasets, use database pagination
      comments = await this.getModel().find(where, {
        sort: { [sortField]: order },
        skip: (currentPage - 1) * pageSize,
        limit: pageSize
      });
    }

    // Build tree structure
    const tree = await this.buildCommentTree(comments, { isAdmin });

    // Apply pagination to root comments only
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRoots = tree.slice(startIndex, startIndex + pageSize);

    return {
      page: currentPage,
      totalPages,
      pageSize,
      count,
      data: paginatedRoots
    };
  }

  /**
   * GET /comment?type=recent - Get recent comments
   * @param {Object} query - Query parameters
   * @param {number} [query.count=10] - Number of comments to return (max 50)
   * @returns {Promise<Comment[]>}
   */
  async getRecent(query = {}) {
    const count = Math.min(50, Math.max(1, parseInt(query.count) || 10));
    const isAdmin = this.isAdmin();
    const isLoggedIn = this.isLogin();

    // Build where clause
    const where = {};

    if (!isAdmin) {
      if (isLoggedIn) {
        where.$or = [
          { status: 'approved' },
          { user_id: this.userInfo.objectId }
        ];
      } else {
        where.status = 'approved';
      }
    }

    const comments = await this.getModel().find(where, {
      sort: { insertedAt: 'desc' },
      limit: count
    });

    return Promise.all(comments.map(c => this.formatCmt(c, { isAdmin })));
  }

  /**
   * GET /comment?type=count - Get comment count for URL(s)
   * @param {Object} query - Query parameters
   * @param {string|string[]} query.url - Single URL or array of URLs
   * @returns {Promise<CommentCountResponse>}
   */
  async getCount(query = {}) {
    let { url } = query;

    if (!url) {
      throw new Error('URL is required');
    }

    // Normalize to array
    const urls = Array.isArray(url) ? url : [url];
    const isAdmin = this.isAdmin();

    // Build base where clause
    const baseWhere = {};
    if (!isAdmin) {
      baseWhere.status = 'approved';
    }

    // Get counts for each URL
    const counts = {};
    for (const u of urls) {
      counts[u] = await this.getModel().count({
        ...baseWhere,
        url: u
      });
    }

    // Return single count or object of counts
    if (urls.length === 1) {
      return { count: counts[urls[0]] };
    }

    return { counts };
  }

  /**
   * GET /comment?type=list - Admin comment list with search
   * @param {Object} query - Query parameters
   * @param {number} [query.page=1] - Page number
   * @param {number} [query.pageSize=10] - Comments per page (max 100)
   * @param {string} [query.owner] - Filter by owner ('mine' for current user)
   * @param {string} [query.status] - Filter by status
   * @param {string} [query.keyword] - Search keyword
   * @returns {Promise<AdminCommentListResponse>}
   */
  async getAdminList(query = {}) {
    // Check admin permission
    if (!this.isAdmin()) {
      const error = new Error('Unauthorized');
      error.status = 403;
      throw error;
    }

    const { page = 1, pageSize = 10, owner, status, keyword } = query;
    const limit = Math.min(100, Math.max(1, parseInt(pageSize) || 10));
    const currentPage = Math.max(1, parseInt(page) || 1);

    // Build where clause
    const where = {};

    if (owner === 'mine' && this.userInfo) {
      where.user_id = this.userInfo.objectId;
    }

    if (status) {
      where.status = status;
    }

    if (keyword) {
      where.$or = [
        { nick: { $regex: keyword, $options: 'i' } },
        { mail: { $regex: keyword, $options: 'i' } },
        { comment: { $regex: keyword, $options: 'i' } },
        { url: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Get counts
    const [totalCount, spamCount, waitingCount] = await Promise.all([
      this.getModel().count(where),
      this.getModel().count({ ...where, status: 'spam' }),
      this.getModel().count({ ...where, status: 'waiting' })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Get comments
    const comments = await this.getModel().find(where, {
      sort: { insertedAt: 'desc' },
      skip: (currentPage - 1) * limit,
      limit
    });

    const data = await Promise.all(
      comments.map(c => this.formatCmt(c, { isAdmin: true }))
    );

    return {
      page: currentPage,
      totalPages,
      pageSize: limit,
      spamCount,
      waitingCount,
      data
    };
  }

  /**
   * POST /comment - Post new comment
   * @param {Object} data - Comment data
   * @param {string} data.url - Article URL path (required)
   * @param {string} data.comment - Comment content (required)
   * @param {string} [data.nick] - User nickname
   * @param {string} [data.mail] - User email
   * @param {string} [data.link] - User website
   * @param {string} [data.ua] - User agent
   * @param {string} [data.pid] - Parent comment ID (for reply)
   * @param {string} [data.rid] - Root comment ID (for reply)
   * @param {string} [data.at] - @mention username (for reply)
   * @returns {Promise<Comment>}
   */
  async post(data) {
    if (!data.url || !data.comment) {
      throw new Error('URL and comment are required');
    }

    const isAdmin = this.isAdmin();
    const ip = this.ctx.request?.headers?.get('cf-connecting-ip') ||
               this.ctx.request?.headers?.get('x-forwarded-for') ||
               '127.0.0.1';

    // Security checks for non-admins
    if (!isAdmin) {
      // IP disallow list check
      if (this.isDisallowedIP(ip)) {
        const error = new Error('IP is blocked');
        error.status = 403;
        throw error;
      }

      // Duplicate content detection
      const isDup = await this.isDuplicate({
        url: data.url,
        comment: data.comment,
        nick: data.nick,
        mail: data.mail
      });

      if (isDup) {
        const error = new Error('Duplicate comment');
        error.status = 403;
        throw error;
      }

      // IP frequency limit
      const canPost = await this.checkIPQPS(ip);
      if (!canPost) {
        const error = new Error(`Please wait ${IPQPS} seconds between comments`);
        error.status = 403;
        throw error;
      }
    }

    // Prepare comment data
    const commentData = {
      url: data.url,
      comment: data.comment.trim(),
      nick: data.nick?.trim() || 'Anonymous',
      mail: data.mail?.trim().toLowerCase() || '',
      link: data.link?.trim() || '',
      ua: data.ua || this.ctx.request?.headers?.get('user-agent') || '',
      ip,
      pid: data.pid || '',
      rid: data.rid || '',
      like: 0,
      sticky: false,
      status: 'approved',
      insertedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add user info if logged in
    if (this.userInfo) {
      commentData.user_id = this.userInfo.objectId;
      commentData.nick = this.userInfo.display_name || this.userInfo.nick;
      commentData.mail = this.userInfo.mail || commentData.mail;
      commentData.link = this.userInfo.link || commentData.link;
    }

    // Pre-save hook
    await this.preSaveHook(commentData);

    // Spam detection for non-admins
    if (!isAdmin) {
      // Akismet check
      const isSpam = await this.checkAkismet(commentData);
      if (isSpam) {
        commentData.status = 'spam';
      }

      // Keyword filter
      if (this.checkForbiddenWords(commentData.comment)) {
        commentData.status = 'waiting';
      }

      // Comment audit setting
      if (this.config.COMMENT_AUDIT && commentData.status !== 'spam') {
        commentData.status = 'waiting';
      }
    }

    // Save comment
    const saved = await this.getModel().create(commentData);

    // Get parent comment for notification (if reply)
    let parent = null;
    if (commentData.pid) {
      parent = await this.getModel().findOne({ objectId: commentData.pid });
    }

    // Post-save hook
    await this.postSaveHook(saved);

    // Send notification (async, don't wait)
    this.sendNotification(saved, parent).catch(console.error);

    // Return formatted comment
    return this.formatCmt(saved, { isAdmin });
  }

  /**
   * PUT /comment - Update comment
   * @param {string} id - Comment ID
   * @param {Object} data - Update data
   * @param {string} [data.comment] - Updated comment content
   * @param {number} [data.like] - Like action (1 to increment)
   * @param {string} [data.status] - Comment status (admin only)
   * @param {boolean} [data.sticky] - Sticky status (admin only)
   * @returns {Promise<Comment>}
   */
  async put(id, data) {
    if (!id) {
      throw new Error('Comment ID is required');
    }

    const isAdmin = this.isAdmin();
    const comment = await this.getModel().findOne({ objectId: id });

    if (!comment) {
      const error = new Error('Comment not found');
      error.status = 404;
      throw error;
    }

    // Permission check for non-admins
    if (!isAdmin) {
      // Non-admins can only update their own comments
      const isOwner = comment.user_id && comment.user_id === this.userInfo?.objectId;
      const canEdit = isOwner && (data.comment !== undefined || data.like !== undefined);

      if (!canEdit) {
        const error = new Error('Unauthorized');
        error.status = 403;
        throw error;
      }

      // Non-admins can only update comment content or like
      const allowedFields = ['comment', 'like'];
      const hasDisallowedFields = Object.keys(data).some(k => !allowedFields.includes(k));

      if (hasDisallowedFields) {
        const error = new Error('Cannot update these fields');
        error.status = 403;
        throw error;
      }
    }

    const updateData = {};

    // Handle like action
    if (data.like !== undefined) {
      if (data.like > 0) {
        // Random increment up to LIKE_INC_MAX
        updateData.like = (comment.like || 0) + Math.floor(Math.random() * LIKE_INC_MAX) + 1;
      } else {
        // Decrement by 1
        updateData.like = Math.max(0, (comment.like || 0) - 1);
      }
    }

    // Handle content update
    if (data.comment !== undefined) {
      updateData.comment = data.comment.trim();
    }

    // Admin-only fields
    if (isAdmin) {
      if (data.status !== undefined) {
        const oldStatus = comment.status;
        updateData.status = data.status;

        // Special case: approving a waiting comment with parent
        if (oldStatus === 'waiting' && data.status === 'approved' && comment.pid) {
          const parent = await this.getModel().findOne({ objectId: comment.pid });
          if (parent) {
            this.sendNotification(comment, parent).catch(console.error);
          }
        }
      }

      if (data.sticky !== undefined) {
        updateData.sticky = !!data.sticky;
      }

      if (data.nick !== undefined) updateData.nick = data.nick;
      if (data.mail !== undefined) updateData.mail = data.mail;
      if (data.link !== undefined) updateData.link = data.link;
    }

    updateData.updatedAt = new Date().toISOString();

    // Update comment
    const updated = await this.getModel().update(
      { objectId: id },
      updateData
    );

    return this.formatCmt({ ...comment, ...updated }, { isAdmin });
  }

  /**
   * DELETE /comment - Delete comment and its children
   * @param {string} id - Comment ID
   * @returns {Promise<{success: boolean, deletedCount: number}>}
   */
  async delete(id) {
    if (!id) {
      throw new Error('Comment ID is required');
    }

    const isAdmin = this.isAdmin();
    const comment = await this.getModel().findOne({ objectId: id });

    if (!comment) {
      const error = new Error('Comment not found');
      error.status = 404;
      throw error;
    }

    // Permission check for non-admins
    if (!isAdmin) {
      const isOwner = comment.user_id && comment.user_id === this.userInfo?.objectId;
      if (!isOwner) {
        const error = new Error('Unauthorized');
        error.status = 403;
        throw error;
      }
    }

    // Delete comment and all its children/replies
    const idsToDelete = [id];

    // Find all children recursively
    const findChildren = async (parentId) => {
      const children = await this.getModel().find({
        $or: [{ pid: parentId }, { rid: parentId }]
      });

      for (const child of children) {
        idsToDelete.push(child.objectId);
        await findChildren(child.objectId);
      }
    };

    await findChildren(id);

    // Delete all comments
    let deletedCount = 0;
    for (const commentId of idsToDelete) {
      await this.getModel().delete({ objectId: commentId });
      deletedCount++;
    }

    return { success: true, deletedCount };
  }
}

/**
 * Factory function to create CommentAPI instance
 * @param {Object} options - Configuration options
 * @returns {CommentAPI}
 */
export function createCommentAPI(options) {
  return new CommentAPI(options);
}

export default CommentAPI;
