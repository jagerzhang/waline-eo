/**
 * Markdown Service for Waline
 * Simple markdown parser for EdgeOne Pages Functions
 * No external dependencies - uses regex-based parsing
 * EdgeOne Pages Functions compatible
 */

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

// Allowed URL protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if URL is safe
 * @param {string} url - URL to check
 * @returns {boolean} True if safe
 */
function isSafeUrl(url) {
  if (!url) return false;
  if (url.startsWith('#')) return true;
  if (url.startsWith('/')) return true;
  if (url.startsWith('./')) return true;

  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content using white list
 * @param {string} html - HTML content to sanitize
 * @param {object} whiteList - Custom white list
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html, whiteList = DEFAULT_WHITE_LIST) {
  if (!html) return '';

  // Simple HTML sanitizer using DOM-like parsing
  // Remove script and style tags completely
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Process each tag
  sanitized = sanitized.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();

    // Check if tag is in white list
    if (!whiteList[lowerTag]) {
      // For non-whitelisted tags, encode them
      return escapeHtml(match);
    }

    // Parse attributes for whitelisted tags
    const allowedAttrs = whiteList[lowerTag];
    const isClosing = match.startsWith('</');

    if (isClosing) {
      return `</${lowerTag}>`;
    }

    // Extract attributes
    const attrRegex = /([a-zA-Z-]+)(?:=["']([^"']*)["'])?/g;
    let attrMatch;
    let validAttrs = [];

    // Skip the tag name itself
    const attrString = match.replace(new RegExp(`^<${tagName}\\s*`, 'i'), '').replace(/>$/, '');

    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2];

      // Check if attribute is allowed
      if (allowedAttrs.includes(attrName) || attrName.startsWith('data-')) {
        // Special handling for href/src attributes
        if ((attrName === 'href' || attrName === 'src') && attrValue) {
          if (isSafeUrl(attrValue)) {
            validAttrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
          }
        } else if (attrValue !== undefined) {
          validAttrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
        } else {
          validAttrs.push(attrName);
        }
      }
    }

    return `<${lowerTag}${validAttrs.length > 0 ? ' ' + validAttrs.join(' ') : ''}>`;
  });

  return sanitized;
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
    breaks = true,
    linkify = true
  } = options;

  let html = markdown;

  // Escape HTML entities first
  html = escapeHtml(html);

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    const escapedCode = code.trim();
    return `<pre class="language-${language}"><code class="language-${language}">${escapedCode}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^\s*[-*_]{3,}\s*$/gim, '<hr>');

  // Bold and Italic (order matters)
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Mark/highlight
  html = html.replace(/==(.*?)==/g, '<mark>$1</mark>');

  // Subscript and superscript
  html = html.replace(/~\~(.*?)~~~/g, '<sub>$1</sub>');
  html = html.replace(/\^\^(.*?)\^\^/g, '<sup>$1</sup>');

  // Images (must be before links)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (isSafeUrl(src)) {
      return `<img src="${src}" alt="${alt}" loading="lazy">`;
    }
    return '';
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    if (isSafeUrl(href)) {
      const isExternal = href.startsWith('http');
      const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer nofollow"' : '';
      return `<a href="${href}"${attrs}>${text}</a>`;
    }
    return text;
  });

  // Auto-link URLs
  if (linkify) {
    html = html.replace(/(https?:\/\/[^\s<>\[\]()]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
  }

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

  // Unordered lists
  html = html.replace(/^(\s*)[-*+] (.*$)/gim, (match, indent, content) => {
    const depth = Math.floor(indent.length / 2);
    return `${'<ul>'.repeat(depth + 1)}<li>${content}</li>${'</ul>'.repeat(depth + 1)}`;
  });

  // Ordered lists
  html = html.replace(/^(\s*)\d+\. (.*$)/gim, (match, indent, content) => {
    const depth = Math.floor(indent.length / 2);
    return `${'<ol>'.repeat(depth + 1)}<li>${content}</li>${'</ol>'.repeat(depth + 1)}`;
  });

  // Tables (simple syntax)
  html = html.replace(/\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
    const headerCells = header.split('|').map(c => c.trim()).filter(c => c);
    const headerHtml = '<tr>' + headerCells.map(c => `<th>${c}</th>`).join('') + '</tr>';

    const rowLines = rows.trim().split('\n');
    const bodyHtml = rowLines.map(line => {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }).join('');

    return `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
  });

  // Definition lists
  html = html.replace(/^([^\n:]+):\s+(.+)$/gim, '<dl><dt>$1</dt><dd>$2</dd></dl>');

  // Footnotes
  html = html.replace(/\[\^(\d+)\]/g, '<sup class="footnote-ref"><a href="#fn$1">$1</a></sup>');

  // Task lists
  html = html.replace(/\[ \] (.*$)/gim, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>');
  html = html.replace(/\[x\] (.*$)/gim, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');

  // Line breaks
  if (breaks) {
    html = html.replace(/\n/g, '<br>\n');
  }

  // Paragraphs - wrap content that's not already wrapped
  // Split by block-level elements and wrap
  const blockElements = 'div|p|h[1-6]|blockquote|pre|table|ul|ol|li|hr|dl|dt|dd';
  const blockRegex = new RegExp(`(<(?:${blockElements})[^>]*>.*?</(?:${blockElements})>|</?(?:${blockElements})[^>]*/?>)`, 'gis');

  const parts = html.split(blockRegex);
  html = parts.map(part => {
    if (!part || !part.trim()) return '';
    if (new RegExp(`^</?(?:${blockElements})`, 'i').test(part.trim())) {
      return part;
    }
    return `<p>${part}</p>`;
  }).join('\n');

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<(pre|blockquote|table|ul|ol|div)[^>]*>.*?<\/\2>)<\/p>/gis, '$1');

  // Emoji shortcuts
  const emojiMap = {
    ':)': '😊',
    ':-)': '😊',
    ':(': '😞',
    ':-(': '😞',
    ':D': '😃',
    ':-D': '😃',
    ';)' : '😉',
    ';-)': '😉',
    ':P': '😛',
    ':-P': '😛',
    ':+1': '👍',
    ':-1': '👎',
    ':fire:': '🔥',
    ':rocket:': '🚀',
    ':heart:': '❤️',
    ':star:': '⭐'
  };

  for (const [shortcut, emoji] of Object.entries(emojiMap)) {
    html = html.replace(new RegExp(escapeRegex(shortcut), 'g'), emoji);
  }

  // Sanitize if enabled
  if (sanitize) {
    html = sanitizeHtml(html, whiteList);
  }

  return html.trim();
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse markdown to HTML (async version)
 * @param {string} markdown - Markdown content
 * @param {object} options - Parse options
 * @returns {Promise<string>} HTML content
 */
async function parseAsync(markdown, options = {}) {
  return parse(markdown, options);
}

/**
 * Extract plain text from markdown
 * @param {string} markdown - Markdown content
 * @returns {string} Plain text
 */
function extractText(markdown) {
  if (!markdown) return '';

  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  text = text.replace(/`[^`]*`/g, '');

  // Remove images
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // Replace links with just the text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Remove markdown syntax
  text = text.replace(/[#*_~>|\-\[\]()^]/g, '');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
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

export {
  parse,
  parseAsync,
  extractText,
  getWordCount,
  checkForbiddenWords,
  truncate,
  sanitizeHtml,
  escapeHtml,
  DEFAULT_WHITE_LIST
};
