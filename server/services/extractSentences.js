/**
 * HTML extraction for translation.
 *
 * - Preserves full document structure (head + body).
 * - Respects skip-on-traverse tags and no-translate markers.
 * - Each leaf block is translated as one segment; inline tags inside blocks
 *   are replaced with placeholder tokens (TAG_OPEN_N, TAG_CLOSE_N) so the
 *   translation model sees full-sentence context and can produce correct
 *   word order (e.g. for Tamil).
 * - Also extracts <title> text and meta[name="description"] content.
 *
 * Output is consumed by translateUrl.js:
 *   const { $, segments } = extractSentenceSegments(rawHtml);
 *   const texts = segments.map((s) => s.text ?? '');
 */

import * as cheerio from 'cheerio';

const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'iframe',
  'code',
  'pre',
  'textarea',
]);

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'li',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'section',
  'article',
  'blockquote',
  'label',
]);

const INLINE_TAGS = new Set([
  'a',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'small',
  'u',
  'sup',
  'sub',
]);

const MAX_BLOCK_TEXT_LEN = 3000;

function hasNoTranslate($el) {
  if (!$el || $el.length === 0) return false;
  if ($el.hasClass('no-translate')) return true;
  const dataTranslate = $el.attr('data-translate');
  if (typeof dataTranslate === 'string' && dataTranslate.toLowerCase() === 'false') {
    return true;
  }
  const translateAttr = $el.attr('translate');
  if (typeof translateAttr === 'string' && translateAttr.toLowerCase() === 'no') {
    return true;
  }
  return false;
}

function isNumericOnly(text) {
  return /^[\d\s.,:+\-/%()]+$/.test(text);
}

/**
 * Decide whether a trimmed core text is worth translating.
 */
function shouldKeepCoreText(core) {
  if (!core) return false;
  const normalized = core.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (normalized.length < 2 && !/[A-Za-z\u00C0-\u017F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(normalized)) {
    return false;
  }
  if (isNumericOnly(normalized)) return false;
  return true;
}

/**
 * Serialize an element's opening tag with attributes for placeholder restore.
 */
function serializeOpeningTag(node) {
  const name = (node.name || '').toLowerCase();
  if (!name) return '<span>';
  let s = '<' + name;
  const attribs = node.attribs || {};
  const keys = Object.keys(attribs).sort();
  for (const k of keys) {
    const v = attribs[k];
    if (v == null) continue;
    const escaped = String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    s += ' ' + k + '="' + escaped + '"';
  }
  s += '>';
  return s;
}

/**
 * Walk a node and build segment text with inline tags replaced by placeholders.
 * Returns { text, counter } (counter is updated for next placeholder index).
 */
function walkBlockContent($, node, tagMap, counter) {
  if (!node) return { text: '', counter };

  if (node.type === 'text') {
    const data = (node.data || '').replace(/\s+/g, ' ');
    return { text: data, counter };
  }

  if (node.type === 'tag') {
    const tagName = (node.name || '').toLowerCase();
    const $el = $(node);

    if (SKIP_TAGS.has(tagName) || hasNoTranslate($el)) {
      return { text: '', counter };
    }

    if (INLINE_TAGS.has(tagName)) {
      const openKey = 'TAG_OPEN_' + counter;
      const closeKey = 'TAG_CLOSE_' + counter;
      counter += 1;
      tagMap[openKey] = serializeOpeningTag(node);
      tagMap[closeKey] = '</' + node.name + '>';
      let inner = '';
      const children = node.children || [];
      for (const child of children) {
        const res = walkBlockContent($, child, tagMap, counter);
        inner += res.text;
        counter = res.counter;
      }
      const innerTrimmed = inner.replace(/\s+/g, ' ').trim();
      const part = innerTrimmed ? openKey + ' ' + innerTrimmed + ' ' + closeKey : openKey + ' ' + closeKey;
      return { text: part, counter };
    }

    // Unknown/inline-like tag: recurse without wrapping in placeholder
    let text = '';
    const children = node.children || [];
    for (const child of children) {
      const res = walkBlockContent($, child, tagMap, counter);
      text += res.text;
      counter = res.counter;
    }
    return { text, counter };
  }

  return { text: '', counter };
}

/**
 * Build one segment per leaf block: full block text with inline tags as placeholders.
 */
function collectBlockSegment($, blockNode) {
  const tagMap = {};
  let fullText = '';
  let counter = 0;
  const children = blockNode.children || [];
  for (const child of children) {
    const res = walkBlockContent($, child, tagMap, counter);
    fullText += (fullText ? ' ' : '') + res.text;
    counter = res.counter;
  }
  fullText = fullText.replace(/\s+/g, ' ').trim();
  if (!shouldKeepCoreText(fullText)) return null;
  if (fullText.length > MAX_BLOCK_TEXT_LEN) {
    // eslint-disable-next-line no-console
    console.warn('[extractSentences] Skipping block >', MAX_BLOCK_TEXT_LEN, 'chars');
    return null;
  }
  return {
    kind: 'block',
    text: fullText,
    tagMap,
    blockRef: blockNode,
  };
}

/**
 * Walk DOM to discover leaf block containers respecting skip/no-translate.
 */
function findLeafBlocks($, rootNode) {
  const leafBlocks = [];

  function walk(node) {
    if (!node) return false;

    if (node.type === 'tag') {
      const tagName = (node.name || '').toLowerCase();
      const $el = $(node);

      if (SKIP_TAGS.has(tagName) || hasNoTranslate($el)) {
        return false;
      }

      let hasBlockDescendant = false;
      const children = node.children || [];
      for (const child of children) {
        if (walk(child)) {
          hasBlockDescendant = true;
        }
      }

      const isBlock = BLOCK_TAGS.has(tagName);
      if (isBlock && !hasBlockDescendant) {
        leafBlocks.push(node);
      }

      return isBlock || hasBlockDescendant;
    }

    if (node.type === 'root') {
      const children = node.children || [];
      let hasBlock = false;
      for (const child of children) {
        if (walk(child)) {
          hasBlock = true;
        }
      }
      return hasBlock;
    }

    return false;
  }

  walk(rootNode);
  return leafBlocks;
}

/**
 * Extract sentence segments from the HTML document.
 *
 * Returns { $, segments } where segments is an ordered array of:
 *   - { kind: 'title', text, elementRef }
 *   - { kind: 'meta-description', text, elementRef }
 *   - { kind: 'block', text, tagMap, blockRef }  — one per leaf block, text has TAG_OPEN_N / TAG_CLOSE_N placeholders
 */
export function extractSentenceSegments(html) {
  if (typeof html !== 'string') {
    throw new Error('extractSentenceSegments: expected HTML string');
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const segments = [];

  // 1. Title text
  const $title = $('head title').first();
  if ($title.length > 0) {
    const titleText = ($title.text() || '').trim();
    if (shouldKeepCoreText(titleText)) {
      segments.push({
        kind: 'title',
        text: titleText,
        elementRef: $title[0],
      });
    }
  }

  // 2. Meta description content
  const $metaDesc = $('meta[name="description"]').first();
  if ($metaDesc.length > 0) {
    const content = ($metaDesc.attr('content') || '').trim();
    if (shouldKeepCoreText(content)) {
      segments.push({
        kind: 'meta-description',
        text: content,
        elementRef: $metaDesc[0],
      });
    }
  }

  // 3. Body leaf blocks → one segment per block (inline tags as placeholders)
  const $body = $('body');
  const rootNode = $body.length > 0 ? $body[0] : $.root()[0];
  const leafBlocks = findLeafBlocks($, rootNode);
  for (const blockNode of leafBlocks) {
    const seg = collectBlockSegment($, blockNode);
    if (seg) segments.push(seg);
  }

  return { $, segments };
}
