/**
 * Minimal Markdown → HTML renderer for Workers
 * Handles common constructs + XSS sanitization
 * Preserves safe <img> tags for local uploads and the shared QQ emoji pack
 */

const QQ_EMOJI_ORIGIN = 'https://kok.plus';
const WALINE_IMAGE_ORIGIN = 'https://wl.kok.plus';

export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text;

  // Preserve safe <img> tags before HTML escaping (emoji support)
  // @waline/client sends emojis as: <img class="wl-emoji" src="..." alt="name">
  // SECURITY: Only keep trusted src plus sanitized alt/class; strip everything else.
  const imgPlaceholders: string[] = [];
  const imgPlaceholderPrefix = `@@WALINEIMG${Math.random().toString(36).slice(2)}@@`;
  html = html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (match, src) => {
    const safeImg = renderTrustedImage(src, getAttr(match, 'alt') || '');
    if (safeImg) {
      const idx = imgPlaceholders.length;
      imgPlaceholders.push(safeImg);
      return `${imgPlaceholderPrefix}${idx}@@`;
    }
    return '';
  });

  html = html.replace(/!\[([^\]]*)\]\(((?:\([^)]*\)|[^)])+)\)/g, (_match, alt, url) => {
    const safeImg = renderMarkdownImage(url, alt);
    if (!safeImg) return alt;

    const idx = imgPlaceholders.length;
    imgPlaceholders.push(safeImg);
    return `${imgPlaceholderPrefix}${idx}@@`;
  });

  // Escape HTML entities (XSS prevention)
  html = escapeHtml(html);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links [text](url) — filter dangerous protocols
  html = html.replace(
    /\[([^\]]+)\]\(((?:\([^)]*\)|[^)])+)\)/g,
    (_match, text, url) => {
      const safeUrl = safeMarkdownLinkUrl(url);
      if (!safeUrl) {
        return `<span>${text}</span>`;
      }
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  );

  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');

  // Strikethrough ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Blockquote (> text)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Headings (# to ######)
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');

  // Unordered lists
  html = html.replace(/^[\*\-\+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Auto-link URLs (not already in href or src)
  html = html.replace(
    /(?<!="|'|>)(https?:\/\/[^\s<)"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Paragraphs: split by double newlines
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap block-level elements
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|p|div|table)/.test(block)) {
        return block;
      }
      return `<p>${block}</p>`;
    })
    .join('\n');

  // Line breaks in paragraphs
  html = html.replace(/(?<!\n)\n(?!\n)/g, '<br />\n');

  // Restore preserved img tags
  for (let i = 0; i < imgPlaceholders.length; i++) {
    html = html.replace(`${imgPlaceholderPrefix}${i}@@`, imgPlaceholders[i]);
  }

  return html.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#96;');
}

function getAttr(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

function renderTrustedImage(rawUrl: string, alt: string): string | null {
  const emojiSrc = trustedEmojiUrl(rawUrl);
  if (emojiSrc) {
    return `<img src="${escapeAttr(emojiSrc)}" class="wl-emoji" alt="${escapeAttr(alt)}" loading="lazy" />`;
  }

  const uploadSrc = trustedUploadUrl(rawUrl);
  if (uploadSrc) {
    return `<img src="${escapeAttr(uploadSrc)}" alt="${escapeAttr(alt)}" loading="lazy" />`;
  }

  return null;
}

function renderMarkdownImage(rawUrl: string, alt: string): string | null {
  const trustedImg = renderTrustedImage(rawUrl, alt);
  if (trustedImg) return trustedImg;

  const url = safeMarkdownImageUrl(rawUrl);
  if (!url) return null;
  return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" />`;
}

function trustedEmojiUrl(rawUrl: string): string | null {
  const url = parseImageUrl(rawUrl);
  if (!url) return null;
  if (url.protocol !== 'https:') return null;
  if (url.origin !== QQ_EMOJI_ORIGIN) return null;
  if (url.search || url.hash) return null;
  if (!/^\/emoji\/qq\/qq_[A-Za-z0-9_-]+\.gif$/.test(url.pathname)) return null;
  return url.toString();
}

function trustedUploadUrl(rawUrl: string): string | null {
  const url = parseImageUrl(rawUrl);
  if (!url) return null;
  if (url.protocol !== 'https:') return null;
  if (url.origin !== WALINE_IMAGE_ORIGIN) return null;
  if (url.search || url.hash) return null;
  if (!/^\/api\/image\/[0-9]+-[A-Za-z0-9]+$/.test(url.pathname)) return null;
  return url.toString();
}

function parseImageUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;

  try {
    const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    return new URL(normalized, WALINE_IMAGE_ORIGIN);
  } catch {
    return null;
  }
}

function safeMarkdownImageUrl(rawUrl: string): string | null {
  const url = parseImageUrl(rawUrl);
  if (!url) return null;
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  return url.toString();
}

function safeMarkdownLinkUrl(rawUrl: string): string | null {
  const trimmed = decodeHtmlEntities(rawUrl).trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!compact) return null;
  if (compact !== trimmed) return null;
  if (/^\/(?!\/)/.test(compact)) return escapeAttr(compact);

  try {
    const url = new URL(compact);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
    return escapeAttr(url.toString());
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
