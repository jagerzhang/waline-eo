/**
 * Minimal Markdown → HTML renderer for Workers
 * Handles common constructs + XSS sanitization
 * Preserves safe <img> tags (emojis from trusted CDNs)
 */

export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text;

  // Preserve safe <img> tags before HTML escaping (emoji support)
  // @waline/client sends emojis as: <img class="wl-emoji" src="//unpkg.com/..." alt="name">
  // SECURITY: Only keep src, alt, class, loading attributes; strip everything else (onerror, onload, etc.)
  const imgPlaceholders: string[] = [];
  html = html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (match, src) => {
    // Allow protocol-relative URLs and https from any source (user-uploaded images, CDNs)
    if (/^(\/\/|https?:\/\/)/.test(src)) {
      // Extract only safe attributes
      const altMatch = match.match(/alt=["']([^"']*)["']/i);
      const classMatch = match.match(/class=["']([^"']*)["']/i);
      const alt = altMatch ? ` alt="${altMatch[1]}"` : '';
      const cls = classMatch ? ` class="${classMatch[1]}"` : '';
      const safeImg = `<img src="${src}"${cls}${alt} loading="lazy" />`;
      const idx = imgPlaceholders.length;
      imgPlaceholders.push(safeImg);
      return `__IMG_PLACEHOLDER_${idx}__`;
    }
    return match;
  });

  // Escape HTML entities (XSS prevention)
  html = escapeHtml(html);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" />',
  );

  // Links [text](url) — filter dangerous protocols
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => {
      const trimmed = url.trim();
      if (/^(javascript|data|vbscript):/i.test(trimmed)) {
        return `<span>${text}</span>`;
      }
      return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${text}</a>`;
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
    html = html.replace(`__IMG_PLACEHOLDER_${i}__`, imgPlaceholders[i]);
  }

  return html.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
