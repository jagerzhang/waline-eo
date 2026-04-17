/**
 * Markdown Service for Waline
 * Features: Markdown-it with plugins, XSS sanitization, syntax highlighting
 */

const MarkdownIt = require('markdown-it');
const xss = require('xss');

// Default XSS white list matching official Waline behavior
const DEFAULT_WHITE_LIST = {
  a: ['href', 'title', 'target', 'rel'],
  abbr: ['title'],
  address: [],
  area: ['shape', 'coords', 'href', 'alt'],
  article: [],
  aside: [],
  audio: ['autoplay', 'controls', 'loop', 'preload', 'src'],
  b: [],
  bdi: ['dir'],
  bdo: ['dir'],
  big: [],
  blockquote: ['cite'],
  br: [],
  caption: [],
  center: [],
  cite: [],
  code: ['class'],
  col: ['align', 'valign', 'span', 'width'],
  colgroup: ['align', 'valign', 'span', 'width'],
  dd: [],
  del: ['datetime'],
  details: ['open'],
  div: ['class'],
  dl: [],
  dt: [],
  em: [],
  figcaption: [],
  figure: [],
  font: ['color', 'size', 'face'],
  footer: [],
  h1: ['id'],
  h2: ['id'],
  h3: ['id'],
  h4: ['id'],
  h5: ['id'],
  h6: ['id'],
  header: [],
  hr: [],
  i: [],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  ins: ['datetime'],
  li: [],
  mark: [],
  nav: [],
  ol: [],
  p: [],
  pre: ['class'],
  s: [],
  section: [],
  small: [],
  span: ['class'],
  sub: [],
  summary: [],
  sup: [],
  strong: [],
  strike: [],
  table: ['width', 'border', 'align', 'valign'],
  tbody: ['align', 'valign'],
  td: ['width', 'rowspan', 'colspan', 'align', 'valign'],
  tfoot: ['align', 'valign'],
  th: ['width', 'rowspan', 'colspan', 'align', 'valign'],
  thead: ['align', 'valign'],
  tr: ['rowspan', 'align', 'valign'],
  tt: [],
  u: [],
  ul: [],
  video: ['autoplay', 'controls', 'loop', 'preload', 'src', 'height', 'width', 'poster'],
  source: ['src', 'type']
};

// MathJax configuration
const MATHJAX_CONFIG = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
  }
};

// KaTeX configuration
const KATEX_CONFIG = {
  throwOnError: false,
  strict: false,
  trust: false,
  macros: {}
};

/**
 * Create markdown-it instance with plugins
 * @param {object} options - Configuration options
 * @returns {MarkdownIt} Configured markdown-it instance
 */
function createMarkdownIt(options = {}) {
  const {
    emoji = true,
    sub = true,
    sup = true,
    math = false,
    mathEngine = 'katex', // 'katex' or 'mathjax'
    highlight = true,
    linkify = true,
    breaks = true,
    html = false
  } = options;

  // Base configuration
  const md = new MarkdownIt({
    html,
    xhtmlOut: false,
    breaks,
    langPrefix: 'language-',
    linkify,
    typographer: true,
    quotes: '""''',
    highlight: highlight ? createHighlighter(options.highlightOptions) : null
  });

  // Enable plugins
  if (emoji) {
    md.use(require('markdown-it-emoji'));
    // Add custom emoji definitions
    md.use(require('markdown-it-emoji'), {
      defs: {
        ...require('markdown-it-emoji/lib/data/full.json'),
        '+1': '\u{1F44D}',
        '-1': '\u{1F44E}',
        '100': '\u{1F4AF}',
        'fire': '\u{1F525}',
        'rocket': '\u{1F680}'
      }
    });
  }

  if (sub) {
    md.use(require('markdown-it-sub'));
  }

  if (sup) {
    md.use(require('markdown-it-sup'));
  }

  if (math) {
    if (mathEngine === 'katex') {
      md.use(require('markdown-it-katex'), KATEX_CONFIG);
    } else {
      md.use(require('markdown-it-mathjax3'), MATHJAX_CONFIG);
    }
  }

  // Container plugin for alerts/notices
  md.use(require('markdown-it-container'), 'tip', {
    validate: (params) => params.trim().match(/^tip\s*(.*)$/),
    render: (tokens, idx) => {
      const m = tokens[idx].info.trim().match(/^tip\s*(.*)$/);
      if (tokens[idx].nesting === 1) {
        return `<div class="waline-tip">${m[1] ? `<div class="waline-tip-title">${md.utils.escapeHtml(m[1])}</div>` : ''}`;
      }
      return '</div>';
    }
  });

  md.use(require('markdown-it-container'), 'warning', {
    validate: (params) => params.trim().match(/^warning\s*(.*)$/),
    render: (tokens, idx) => {
      const m = tokens[idx].info.trim().match(/^warning\s*(.*)$/);
      if (tokens[idx].nesting === 1) {
        return `<div class="waline-warning">${m[1] ? `<div class="waline-warning-title">${md.utils.escapeHtml(m[1])}</div>` : ''}`;
      }
      return '</div>';
    }
  });

  md.use(require('markdown-it-container'), 'danger', {
    validate: (params) => params.trim().match(/^danger\s*(.*)$/),
    render: (tokens, idx) => {
      const m = tokens[idx].info.trim().match(/^danger\s*(.*)$/);
      if (tokens[idx].nesting === 1) {
        return `<div class="waline-danger">${m[1] ? `<div class="waline-danger-title">${md.utils.escapeHtml(m[1])}</div>` : ''}`;
      }
      return '</div>';
    }
  });

  // Mark plugin
  md.use(require('markdown-it-mark'));

  // Ins plugin
  md.use(require('markdown-it-ins'));

  // Deflist plugin
  md.use(require('markdown-it-deflist'));

  // Footnote plugin
  md.use(require('markdown-it-footnote'));

  // Task lists
  md.use(require('markdown-it-task-lists'), {
    enabled: true,
    label: true,
    labelAfter: true
  });

  // Custom link handling
  md.use(require('markdown-it-link-attributes'), {
    matcher: (href) => href.startsWith('http'),
    attrs: {
      target: '_blank',
      rel: 'noopener noreferrer nofollow'
    }
  });

  return md;
}

/**
 * Create syntax highlighter function
 * @param {object} options - Highlight options
 * @returns {Function} Highlighter function
 */
function createHighlighter(options = {}) {
  const {
    lineNumbers = true,
    preload = ['javascript', 'css', 'html', 'python', 'bash'],
    theme = 'default'
  } = options;

  return function(str, lang) {
    if (!lang) {
      return `<pre class="waline-code"><code>${escapeHtml(str)}</code></pre>`;
    }

    const langClass = `language-${lang}`;

    if (lineNumbers) {
      const lines = str.split('\n').length;
      const lineNumbersHtml = Array.from({ length: lines }, (_, i) =>
        `<span class="line-number">${i + 1}</span>`
      ).join('');

      return `<div class="waline-code-block ${theme}">
        <div class="code-header">
          <span class="code-lang">${lang}</span>
          <button class="copy-btn" data-clipboard-text="${escapeHtml(str)}">Copy</button>
        </div>
        <div class="code-wrapper">
          <div class="line-numbers">${lineNumbersHtml}</div>
          <pre class="${langClass}"><code class="${langClass}">${escapeHtml(str)}</code></pre>
        </div>
      </div>`;
    }

    return `<div class="waline-code-block ${theme}">
      <div class="code-header">
        <span class="code-lang">${lang}</span>
        <button class="copy-btn" data-clipboard-text="${escapeHtml(str)}">Copy</button>
      </div>
      <pre class="${langClass}"><code class="${langClass}">${escapeHtml(str)}</code></pre>
    </div>`;
  };
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize HTML content using XSS filter
 * @param {string} html - HTML content to sanitize
 * @param {object} whiteList - Custom white list
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html, whiteList = DEFAULT_WHITE_LIST) {
  if (!html) return '';

  const xssOptions = {
    whiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    onIgnoreTag: (tag, html, options) => {
      // Allow specific data attributes
      if (tag.startsWith('data-')) {
        return html;
      }
      return undefined;
    },
    onIgnoreTagAttr: (tag, name, value, isWhiteAttr) => {
      // Allow data-* attributes
      if (name.startsWith('data-')) {
        return `${name}="${xss.escapeAttrValue(value)}"`;
      }
      // Allow specific class patterns
      if (name === 'class') {
        const allowedClasses = value.split(' ').filter(cls =>
          cls.startsWith('language-') ||
          cls.startsWith('waline-') ||
          cls.startsWith('line-') ||
          cls.startsWith('hljs-') ||
          ['copy-btn', 'code-header', 'code-wrapper', 'code-lang'].includes(cls)
        );
        if (allowedClasses.length > 0) {
          return `class="${allowedClasses.join(' ')}"`;
        }
      }
      return undefined;
    }
  };

  return xss(html, xssOptions);
}

/**
 * Parse markdown to HTML
 * @param {string} markdown - Markdown content
 * @param {object} options - Parse options
 * @returns {string} HTML content
 */
function parse(markdown, options = {}) {
  if (!markdown) return '';

  const {
    sanitize = true,
    whiteList,
    markdownOptions = {}
  } = options;

  // Create markdown-it instance
  const md = createMarkdownIt(markdownOptions);

  // Parse markdown
  let html = md.render(markdown);

  // Sanitize if enabled
  if (sanitize) {
    html = sanitizeHtml(html, whiteList);
  }

  return html;
}

/**
 * Parse markdown to HTML (async version with external highlighter)
 * @param {string} markdown - Markdown content
 * @param {object} options - Parse options
 * @returns {Promise<string>} HTML content
 */
async function parseAsync(markdown, options = {}) {
  if (!markdown) return '';

  const {
    sanitize = true,
    whiteList,
    markdownOptions = {},
    highlighter = null // External highlighter function
  } = options;

  // Create markdown-it instance
  const mdOptions = { ...markdownOptions };
  if (highlighter) {
    mdOptions.highlight = highlighter;
  }

  const md = createMarkdownIt(mdOptions);

  // Parse markdown
  let html = md.render(markdown);

  // Sanitize if enabled
  if (sanitize) {
    html = sanitizeHtml(html, whiteList);
  }

  return html;
}

/**
 * Extract plain text from markdown
 * @param {string} markdown - Markdown content
 * @returns {string} Plain text
 */
function extractText(markdown) {
  if (!markdown) return '';

  const md = createMarkdownIt({
    emoji: false,
    sub: false,
    sup: false,
    math: false,
    highlight: false,
    linkify: false
  });

  // Render to HTML then strip tags
  const html = md.render(markdown);
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get word count from markdown
 * @param {string} markdown - Markdown content
 * @returns {number} Word count
 */
function getWordCount(markdown) {
  const text = extractText(markdown);
  // Count CJK characters and words
  const cjkCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const wordCount = (text.match(/[a-zA-Z]+/g) || []).length;
  return cjkCount + wordCount;
}

/**
 * Check if content contains forbidden words
 * @param {string} markdown - Markdown content
 * @param {string[]} forbiddenWords - List of forbidden words
 * @returns {boolean} True if contains forbidden words
 */
function checkForbiddenWords(markdown, forbiddenWords = []) {
  if (!forbiddenWords.length) return false;

  const text = extractText(markdown).toLowerCase();
  return forbiddenWords.some(word =>
    text.includes(word.toLowerCase())
  );
}

/**
 * Truncate markdown content
 * @param {string} markdown - Markdown content
 * @param {number} length - Max length
 * @param {string} suffix - Suffix for truncated content
 * @returns {string} Truncated content
 */
function truncate(markdown, length = 200, suffix = '...') {
  const text = extractText(markdown);
  if (text.length <= length) return text;
  return text.substring(0, length) + suffix;
}

module.exports = {
  parse,
  parseAsync,
  extractText,
  getWordCount,
  checkForbiddenWords,
  truncate,
  sanitizeHtml,
  escapeHtml,
  createMarkdownIt,
  DEFAULT_WHITE_LIST,
  MATHJAX_CONFIG,
  KATEX_CONFIG
};
