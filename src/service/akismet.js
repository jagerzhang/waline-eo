/**
 * Akismet Spam Detection Service for Waline
 * Provides spam checking and key verification for comments
 * EdgeOne Pages Functions compatible - uses fetch API only
 */

const AKISMET_ENDPOINT = 'https://rest.akismet.com';
const AKISMET_API_VERSION = '1.1';

/**
 * Akismet client configuration
 */
class AkismetClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.blog = config.blog || '';
    this.userAgent = config.userAgent || 'Waline/1.0 | Akismet/1.0';
    this.timeout = config.timeout || 5000;
  }

  /**
   * Build Akismet API URL
   * @param {string} endpoint - API endpoint
   * @returns {string} Full API URL
   */
  buildUrl(endpoint) {
    if (endpoint === 'verify-key') {
      return `${AKISMET_ENDPOINT}/${AKISMET_API_VERSION}/verify-key`;
    }
    return `https://${this.apiKey}.rest.akismet.com/${AKISMET_API_VERSION}/${endpoint}`;
  }

  /**
   * Build request body for Akismet API
   * @param {object} data - Comment data
   * @returns {URLSearchParams} Form data
   */
  buildRequestBody(data) {
    const params = new URLSearchParams();

    // Required fields
    params.append('blog', this.blog);
    params.append('user_ip', data.userIp || '127.0.0.1');
    params.append('user_agent', data.userAgent || 'Mozilla/5.0');

    // Optional fields
    if (data.referrer) params.append('referrer', data.referrer);
    if (data.permalink) params.append('permalink', data.permalink);
    if (data.type) params.append('comment_type', data.type);
    if (data.author) params.append('comment_author', data.author);
    if (data.authorEmail) params.append('comment_author_email', data.authorEmail);
    if (data.authorUrl) params.append('comment_author_url', data.authorUrl);
    if (data.content) params.append('comment_content', data.content);
    if (data.date) params.append('comment_date_gmt', data.date);
    if (data.postModified) params.append('comment_post_modified_gmt', data.postModified);
    if (data.blogLang) params.append('blog_lang', data.blogLang);
    if (data.blogCharset) params.append('blog_charset', data.blogCharset);
    if (data.isTest) params.append('is_test', '1');

    // Server environment
    if (data.serverEnv) {
      const env = data.serverEnv;
      if (env.serverHostname) params.append('SERVER_HOSTNAME', env.serverHostname);
      if (env.serverPort) params.append('SERVER_PORT', env.serverPort);
      if (env.serverProtocol) params.append('SERVER_PROTOCOL', env.serverProtocol);
      if (env.requestMethod) params.append('REQUEST_METHOD', env.requestMethod);
      if (env.requestUri) params.append('REQUEST_URI', env.requestUri);
      if (env.httpUserAgent) params.append('HTTP_USER_AGENT', env.httpUserAgent);
      if (env.httpReferer) params.append('HTTP_REFERER', env.httpReferer);
    }

    return params;
  }

  /**
   * Make HTTP request to Akismet API
   * @param {string} endpoint - API endpoint
   * @param {URLSearchParams} body - Request body
   * @returns {Promise<Response>} Fetch response
   */
  async request(endpoint, body) {
    const url = this.buildUrl(endpoint);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        body: body.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * Verify Akismet API key
 * @param {string} apiKey - Akismet API key
 * @param {string} blog - Blog URL
 * @returns {Promise<boolean>} True if key is valid
 */
async function verifyKey(apiKey, blog) {
  if (!apiKey || !blog) {
    return false;
  }

  try {
    const client = new AkismetClient({ apiKey, blog });
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('blog', blog);

    const response = await client.request('verify-key', body);
    const result = await response.text();

    return result === 'valid';
  } catch (error) {
    console.error('Akismet key verification error:', error);
    return false;
  }
}

/**
 * Check if comment is spam
 * @param {object} comment - Comment data
 * @param {object} config - Akismet configuration
 * @returns {Promise<object>} Check result
 */
async function checkComment(comment, config) {
  if (!config || !config.apiKey || !config.blog) {
    return {
      isSpam: false,
      isBlatantSpam: false,
      error: 'Akismet not configured'
    };
  }

  try {
    const client = new AkismetClient(config);
    const body = client.buildRequestBody(comment);

    const response = await client.request('comment-check', body);
    const result = await response.text();

    // Check for X-akismet-pro-tip header (indicates blatant spam)
    const proTip = response.headers.get('X-akismet-pro-tip');
    const isBlatantSpam = proTip === 'discard';

    // Check for debug help
    const debugHelp = response.headers.get('X-akismet-debug-help');

    return {
      isSpam: result === 'true',
      isBlatantSpam,
      debugHelp,
      error: null
    };
  } catch (error) {
    console.error('Akismet check error:', error);
    return {
      isSpam: false,
      isBlatantSpam: false,
      error: error.message
    };
  }
}

/**
 * Submit ham (not spam) to Akismet
 * Used when a comment was incorrectly marked as spam
 * @param {object} comment - Comment data
 * @param {object} config - Akismet configuration
 * @returns {Promise<boolean>} Success status
 */
async function submitHam(comment, config) {
  if (!config || !config.apiKey || !config.blog) {
    return false;
  }

  try {
    const client = new AkismetClient(config);
    const body = client.buildRequestBody(comment);

    const response = await client.request('submit-ham', body);
    const result = await response.text();

    return result === 'Thanks for making the web a better place.';
  } catch (error) {
    console.error('Akismet submit ham error:', error);
    return false;
  }
}

/**
 * Submit spam to Akismet
 * Used when a comment was incorrectly marked as ham
 * @param {object} comment - Comment data
 * @param {object} config - Akismet configuration
 * @returns {Promise<boolean>} Success status
 */
async function submitSpam(comment, config) {
  if (!config || !config.apiKey || !config.blog) {
    return false;
  }

  try {
    const client = new AkismetClient(config);
    const body = client.buildRequestBody(comment);

    const response = await client.request('submit-spam', body);
    const result = await response.text();

    return result === 'Thanks for making the web a better place.';
  } catch (error) {
    console.error('Akismet submit spam error:', error);
    return false;
  }
}

/**
 * Build comment data from Waline comment
 * @param {object} comment - Waline comment object
 * @param {object} context - Request context
 * @returns {object} Akismet formatted comment data
 */
function buildCommentData(comment, context = {}) {
  const now = new Date().toISOString();

  return {
    userIp: comment.ip || context.ip || '127.0.0.1',
    userAgent: comment.ua || context.ua || 'Mozilla/5.0',
    referrer: context.referrer || '',
    permalink: comment.url || context.url || '',
    type: 'comment',
    author: comment.nick || '',
    authorEmail: comment.mail || '',
    authorUrl: comment.link || '',
    content: comment.comment || '',
    date: comment.createdAt || now,
    postModified: now,
    blogLang: context.lang || 'en_US',
    blogCharset: 'UTF-8',
    serverEnv: {
      serverHostname: context.hostname || '',
      serverPort: context.port || '443',
      serverProtocol: context.protocol || 'https',
      requestMethod: context.method || 'POST',
      requestUri: context.path || '',
      httpUserAgent: comment.ua || context.ua || '',
      httpReferer: context.referrer || ''
    }
  };
}

/**
 * Check comment with spam protection
 * Combines Akismet with local spam rules
 * @param {object} comment - Comment data
 * @param {object} config - Spam protection config
 * @returns {Promise<object>} Check result with action recommendation
 */
async function checkSpam(comment, config = {}) {
  const result = {
    isSpam: false,
    isBlatantSpam: false,
    reason: null,
    action: 'allow', // 'allow', 'moderate', 'reject'
    akismetResult: null
  };

  // Check forbidden words
  if (config.forbiddenWords && config.forbiddenWords.length > 0) {
    const content = (comment.comment || '').toLowerCase();
    const hasForbiddenWord = config.forbiddenWords.some(word =>
      content.includes(word.toLowerCase())
    );

    if (hasForbiddenWord) {
      result.isSpam = true;
      result.reason = 'forbidden_word';
      result.action = config.forbiddenAction || 'reject';
      return result;
    }
  }

  // Check required fields
  if (config.requiredFields && config.requiredFields.length > 0) {
    const missingFields = config.requiredFields.filter(field =>
      !comment[field] || comment[field].trim() === ''
    );

    if (missingFields.length > 0) {
      result.isSpam = true;
      result.reason = 'missing_required_fields';
      result.action = 'reject';
      return result;
    }
  }

  // Check Akismet
  if (config.akismet && config.akismet.apiKey) {
    const akismetData = buildCommentData(comment, config.context);
    const akismetResult = await checkComment(akismetData, config.akismet);

    result.akismetResult = akismetResult;

    if (akismetResult.isBlatantSpam) {
      result.isSpam = true;
      result.isBlatantSpam = true;
      result.reason = 'akismet_blatant_spam';
      result.action = 'reject';
      return result;
    }

    if (akismetResult.isSpam) {
      result.isSpam = true;
      result.reason = 'akismet_spam';
      result.action = config.akismet.spamAction || 'moderate';
      return result;
    }
  }

  // Check rate limiting
  if (config.rateLimit) {
    // Rate limiting should be handled at the application level
    // This is just a placeholder for the check
    const { max, window } = config.rateLimit;
    // Implementation would check against storage
    void max;
    void window;
  }

  // Check duplicate content
  if (config.noDuplicate) {
    // Duplicate checking should be handled at the application level
  }

  return result;
}

/**
 * Get Akismet statistics
 * Note: Akismet doesn't provide a direct stats API
 * This is a placeholder for future implementation
 * @param {object} config - Akismet configuration
 * @returns {Promise<object>} Statistics
 */
async function getStats(config) {
  if (!config || !config.apiKey) {
    return null;
  }

  // Akismet doesn't have a public stats API
  // Stats are available through the WordPress dashboard or Akismet website
  return {
    message: 'Stats available at https://akismet.com/account/'
  };
}

export {
  AkismetClient,
  verifyKey,
  checkComment,
  submitHam,
  submitSpam,
  buildCommentData,
  checkSpam,
  getStats
};
