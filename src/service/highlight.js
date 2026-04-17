/**
 * Code Highlighting Service
 * Provides syntax highlighting for code blocks in comments
 * Compatible with EdgeOne Pages Functions (Web API only)
 */

// Common language patterns for basic syntax highlighting
const LANGUAGE_PATTERNS = {
  javascript: {
    keywords: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|try|catch|throw|typeof|instanceof)\b/g,
    strings: /(['"`])((?:\\\1|.)*?)\1/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  typescript: {
    keywords: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|try|catch|throw|typeof|instanceof|interface|type|enum|namespace|declare|abstract|readonly|private|protected|public)\b/g,
    strings: /(['"`])((?:\\\1|.)*?)\1/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  python: {
    keywords: /\b(def|class|return|if|elif|else|for|while|try|except|finally|with|import|from|as|pass|break|continue|lambda|yield|async|await|raise|assert|del|global|nonlocal)\b/g,
    strings: /(['"])((?:\\\1|.)*?)\1/g,
    comments: /#.*$/gm,
    numbers: /\b\d+\.?\d*\b/g,
  },
  java: {
    keywords: /\b(public|private|protected|static|final|class|interface|extends|implements|return|if|else|for|while|try|catch|finally|throw|new|this|super|import|package|void|int|long|double|float|boolean|char|byte|short)\b/g,
    strings: /("(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  css: {
    properties: /\b([a-z-]+)(?=\s*:)/gi,
    selectors: /([.#][a-zA-Z_-][a-zA-Z0-9_-]*|\b[a-z-]+)(?=\s*\{)/g,
    values: /:\s*([^;{}]+)/g,
    comments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*(?:px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax|s|ms|deg|rad|grad|turn|Hz|kHz|dpi|dpcm|dppx)?\b/gi,
  },
  html: {
    tags: /&lt;\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^&>]*)?&gt;/g,
    attributes: /\s[a-zA-Z-]+(?==)/g,
    strings: /"[^"]*"/g,
    comments: /&lt;!--[\s\S]*?--&gt;/g,
  },
  bash: {
    keywords: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|export|source|alias|unset|readonly|local|shift|break|continue|eval|exec)\b/g,
    strings: /(['"])((?:\\\1|.)*?)\1/g,
    comments: /#.*$/gm,
    variables: /\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]*\}/g,
  },
  sql: {
    keywords: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|NOT|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|AS|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|COLUMN|VALUES|INTO|SET|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|CHECK|CONSTRAINT|DATABASE|USE|SHOW|DESCRIBE|EXPLAIN|BEGIN|COMMIT|ROLLBACK|TRANSACTION)\b/gi,
    strings: /('(?:''|[^'])*')/g,
    comments: /--.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  json: {
    keys: /"([^"]+)":/g,
    strings: /"([^"]+)"/g,
    numbers: /\b\d+\.?\d*\b/g,
    booleans: /\b(true|false|null)\b/g,
  },
  yaml: {
    keys: /^[\s-]*([a-zA-Z_][a-zA-Z0-9_]*):/gm,
    strings: /(['"])((?:\\\1|.)*?)\1/g,
    comments: /#.*$/gm,
    numbers: /\b\d+\.?\d*\b/g,
    booleans: /\b(true|false|null|yes|no)\b/g,
  },
  markdown: {
    headers: /^#{1,6}\s+.+$/gm,
    bold: /\*\*[^*]+\*\*|__[^_]+__/g,
    italic: /\*[^*]+\*|_[^_]+_/g,
    code: /`[^`]+`/g,
    links: /\[([^\]]+)\]\(([^)]+)\)/g,
    blockquotes: /^>\s+.+$/gm,
  },
  go: {
    keywords: /\b(package|import|func|return|if|else|for|range|switch|case|default|break|continue|goto|fallthrough|defer|go|chan|select|const|var|type|struct|interface|map|make|new|len|cap|append|copy|delete|close|panic|recover|print|println)\b/g,
    strings: /(`(?:[^`]|\n)*`|"(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
  },
  rust: {
    keywords: /\b(fn|let|mut|const|static|if|else|match|for|while|loop|return|break|continue|struct|enum|impl|trait|type|pub|use|mod|crate|self|super|async|await|move|ref|where|unsafe|extern|as|in|box|dyn)\b/g,
    strings: /("(?:\\.|[^"\\])*"|b"(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    macros: /\b[a-zA-Z_][a-zA-Z0-9_]*!/g,
  },
  php: {
    keywords: /\b(php|echo|print|if|else|elseif|endif|for|foreach|while|do|switch|case|default|break|continue|return|function|class|public|private|protected|static|const|var|new|extends|implements|interface|abstract|final|try|catch|finally|throw|namespace|use|require|include|require_once|include_once|global|isset|unset|empty|die|exit|eval|list|array|callable|int|float|bool|string|void|iterable|object|mixed)\b/gi,
    strings: /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g,
    comments: /(\/\/|#).*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    variables: /\$[a-zA-Z_][a-zA-Z0-9_]*/g,
  },
  ruby: {
    keywords: /\b(def|class|module|end|if|unless|else|elsif|case|when|while|until|for|in|do|begin|rescue|ensure|retry|break|next|return|yield|self|super|nil|true|false|and|or|not|alias|undef|defined?|lambda|proc)\b/g,
    strings: /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|%[qQwWiIrIx]?\{[^}]*\}|%[qQwWiIrIx]?\[[^\]]*\]|%[qQwWiIrIx]?\([^)]*\)|%[qQwWiIrIx]?<[^>]*>)/g,
    comments: /#.*$/gm,
    numbers: /\b\d+\.?\d*\b/g,
    symbols: /:[a-zA-Z_][a-zA-Z0-9_]*|:["'][^"']+["']/g,
    variables: /@[a-zA-Z_][a-zA-Z0-9_]*|@@[a-zA-Z_][a-zA-Z0-9_]*|\$[a-zA-Z_][a-zA-Z0-9_]*/g,
  },
  c: {
    keywords: /\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|inline|restrict|_Bool|_Complex|_Imaginary)\b/g,
    strings: /("(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    preprocessor: /^\s*#\s*(include|define|ifdef|ifndef|endif|if|else|elif|pragma|error|warning)\b/gm,
  },
  cpp: {
    keywords: /\b(alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\b/g,
    strings: /("(?:\\.|[^"\\])*"|R"\([^)]*\)")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    preprocessor: /^\s*#\s*(include|define|ifdef|ifndef|endif|if|else|elif|pragma|error|warning)\b/gm,
  },
  swift: {
    keywords: /\b(associatedtype|class|deinit|enum|extension|fileprivate|func|import|init|inout|internal|let|open|operator|private|protocol|public|rethrows|static|struct|subscript|typealias|var|break|case|continue|default|defer|do|else|fallthrough|for|guard|if|in|repeat|return|switch|where|while|as|Any|catch|false|is|nil|super|self|Self|throw|throws|true|try|discardableResult|available|objc|IBAction|IBOutlet)\b/g,
    strings: /("(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    attributes: /@\w+/g,
  },
  kotlin: {
    keywords: /\b(abstract|actual|annotation|as|as?|break|by|catch|class|companion|const|constructor|continue|crossinline|data|delegate|do|dynamic|else|enum|expect|external|false|field|file|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|it|lateinit|noinline|null|object|open|operator|out|override|package|param|private|property|protected|public|receiver|reified|return|sealed|set|setparam|super|suspend|tailrec|this|throw|true|try|typealias|typeof|val|var|vararg|when|where|while)\b/g,
    strings: /("""[\s\S]*?"""|"(?:\\.|[^"\\])*")/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    annotations: /@\w+/g,
  },
  dart: {
    keywords: /\b(abstract|as|assert|async|await|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|set|show|static|super|switch|sync|this|throw|true|try|typedef|var|void|while|with|yield)\b/g,
    strings: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
    comments: /\/\/.*$/gm,
    multilineComments: /\/\*[\s\S]*?\*\//g,
    numbers: /\b\d+\.?\d*\b/g,
    annotations: /@\w+/g,
  },
};

// CSS classes for syntax highlighting
const CSS_CLASSES = {
  keyword: 'hljs-keyword',
  string: 'hljs-string',
  number: 'hljs-number',
  comment: 'hljs-comment',
  function: 'hljs-function',
  class: 'hljs-class',
  variable: 'hljs-variable',
  operator: 'hljs-operator',
  property: 'hljs-property',
  tag: 'hljs-tag',
  attribute: 'hljs-attribute',
  boolean: 'hljs-boolean',
  selector: 'hljs-selector',
  preprocessor: 'hljs-preprocessor',
  macro: 'hljs-macro',
  symbol: 'hljs-symbol',
  annotation: 'hljs-annotation',
};

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Apply syntax highlighting to code
 * @param {string} code - Code to highlight
 * @param {string} language - Programming language
 * @returns {string} Highlighted HTML
 */
export function highlightCode(code, language) {
  if (!code) return '';

  const lang = language?.toLowerCase() || 'text';
  const patterns = LANGUAGE_PATTERNS[lang];

  if (!patterns) {
    // No patterns for this language, just escape HTML
    return escapeHtml(code);
  }

  // Escape HTML first
  let highlighted = escapeHtml(code);

  // Track already highlighted parts to avoid double-highlighting
  const tokens = [];
  let tokenId = 0;

  // Replace matches with placeholders
  const replaceWithPlaceholder = (match, className) => {
    const id = `__TOKEN_${tokenId++}__`;
    tokens.push({ id, content: match, className });
    return id;
  };

  // Apply highlighting in order: comments -> strings -> keywords -> numbers
  if (patterns.multilineComments) {
    highlighted = highlighted.replace(patterns.multilineComments, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.comment)
    );
  }

  if (patterns.comments) {
    highlighted = highlighted.replace(patterns.comments, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.comment)
    );
  }

  if (patterns.strings) {
    highlighted = highlighted.replace(patterns.strings, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.string)
    );
  }

  if (patterns.keywords) {
    highlighted = highlighted.replace(patterns.keywords, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.keyword)
    );
  }

  if (patterns.numbers) {
    highlighted = highlighted.replace(patterns.numbers, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.number)
    );
  }

  if (patterns.booleans) {
    highlighted = highlighted.replace(patterns.booleans, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.boolean)
    );
  }

  if (patterns.functions) {
    highlighted = highlighted.replace(patterns.functions, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.function)
    );
  }

  if (patterns.variables) {
    highlighted = highlighted.replace(patterns.variables, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.variable)
    );
  }

  if (patterns.properties) {
    highlighted = highlighted.replace(patterns.properties, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.property)
    );
  }

  if (patterns.selectors) {
    highlighted = highlighted.replace(patterns.selectors, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.selector)
    );
  }

  if (patterns.tags) {
    highlighted = highlighted.replace(patterns.tags, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.tag)
    );
  }

  if (patterns.attributes) {
    highlighted = highlighted.replace(patterns.attributes, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.attribute)
    );
  }

  if (patterns.preprocessor) {
    highlighted = highlighted.replace(patterns.preprocessor, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.preprocessor)
    );
  }

  if (patterns.macros) {
    highlighted = highlighted.replace(patterns.macros, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.macro)
    );
  }

  if (patterns.symbols) {
    highlighted = highlighted.replace(patterns.symbols, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.symbol)
    );
  }

  if (patterns.annotations) {
    highlighted = highlighted.replace(patterns.annotations, (m) =>
      replaceWithPlaceholder(m, CSS_CLASSES.annotation)
    );
  }

  // Replace placeholders with actual HTML
  tokens.reverse().forEach(({ id, content, className }) => {
    highlighted = highlighted.replace(
      id,
      `<span class="${className}">${escapeHtml(content)}</span>`
    );
  });

  return highlighted;
}

/**
 * Detect programming language from code
 * @param {string} code - Code to analyze
 * @returns {string} Detected language or 'text'
 */
export function detectLanguage(code) {
  if (!code) return 'text';

  // Simple heuristics for language detection
  if (code.includes('<?php')) return 'php';
  if (code.includes('import ') && code.includes('from ')) return 'javascript';
  if (code.includes('def ') && code.includes(':')) return 'python';
  if (code.includes('func ') || code.includes('package ')) return 'go';
  if (code.includes('fn ') || code.includes('let ') || code.includes('impl ')) return 'rust';
  if (code.includes('<html') || code.includes('<!DOCTYPE')) return 'html';
  if (code.includes('{') && code.includes('}') && code.includes(':')) {
    if (code.includes('@media') || code.includes('@import')) return 'css';
  }
  if (code.includes('SELECT ') || code.includes('INSERT ')) return 'sql';
  if (code.includes('#!/bin/bash') || code.includes('#!/bin/sh')) return 'bash';
  if (code.includes('class ') && code.includes('extends')) {
    if (code.includes('public static')) return 'java';
  }
  if (code.includes('puts ') || code.includes('def ') && code.includes('end')) return 'ruby';
  if (code.includes('#include')) {
    if (code.includes('cout') || code.includes('cin') || code.includes('std::')) return 'cpp';
    return 'c';
  }
  if (code.includes('val ') || code.includes('var ') && code.includes('fun ')) return 'kotlin';
  if (code.includes('let ') && code.includes('var ') && code.includes('func ')) return 'swift';
  if (code.includes('const ') && code.includes('interface ') && code.includes('type ')) return 'typescript';
  if (code.includes('final ') && code.includes('class ') && code.includes('extends')) {
    if (code.includes('@Override')) return 'java';
  }
  if (code.includes('async ') && code.includes('await ')) {
    if (code.includes(': string') || code.includes(': number') || code.includes(': boolean')) return 'typescript';
  }
  if (code.includes('Widget') || code.includes('StatelessWidget') || code.includes('StatefulWidget')) return 'dart';

  return 'text';
}

/**
 * Get highlight.js style CSS
 * @returns {string} CSS styles for syntax highlighting
 */
export function getHighlightStyles() {
  return `
    .hljs { display: block; overflow-x: auto; padding: 0.5em; background: #f5f5f5; }
    .hljs-keyword { color: #d73a49; font-weight: bold; }
    .hljs-string { color: #032f62; }
    .hljs-number { color: #005cc5; }
    .hljs-comment { color: #6a737d; font-style: italic; }
    .hljs-function { color: #6f42c1; }
    .hljs-class { color: #22863a; }
    .hljs-variable { color: #e36209; }
    .hljs-operator { color: #d73a49; }
    .hljs-property { color: #005cc5; }
    .hljs-tag { color: #22863a; }
    .hljs-attribute { color: #6f42c1; }
    .hljs-boolean { color: #005cc5; }
    .hljs-selector { color: #22863a; }
    .hljs-preprocessor { color: #6f42c1; }
    .hljs-macro { color: #e36209; }
    .hljs-symbol { color: #005cc5; }
    .hljs-annotation { color: #6f42c1; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }
    code { font-family: 'SF Mono', Monaco, Inconsolata, 'Fira Code', monospace; font-size: 0.9em; }
  `;
}

export default {
  highlightCode,
  detectLanguage,
  getHighlightStyles,
  LANGUAGE_PATTERNS,
};
