/**
 * Preprocessing for translation pipeline.
 * - Normalize whitespace
 * - Merge broken lines inside sentences
 * - Preserve paragraph separation
 * - Split into translation units (sentence-by-sentence)
 */

/**
 * Normalize text: remove line breaks inside sentences, collapse spaces, trim.
 * Preserves paragraph separation. Critical for preventing "distribuidos Crea" merging.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Normalize whitespace: collapse runs, normalize line endings.
 * @param {string} text
 * @returns {string}
 */
export function normalizeWhitespace(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Merge lines that are broken mid-sentence (e.g. "Hello\nWorld" when it's one sentence).
 * Preserves paragraph breaks (\n\n).
 * @param {string} text
 * @returns {string[]} Array of paragraphs (empty string = paragraph break)
 */
export function mergeBrokenLines(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const lines = normalized.split(/\n/);
  const merged = [];
  let buffer = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buffer) {
        merged.push(buffer);
        buffer = '';
      }
      merged.push('');
      continue;
    }
    if (buffer) {
      buffer += ' ' + trimmed;
    } else {
      buffer = trimmed;
    }
    if (/[.!?]\s*$/.test(trimmed)) {
      merged.push(buffer);
      buffer = '';
    }
  }
  if (buffer) merged.push(buffer);
  return merged;
}

/**
 * Split text into sentences. Do NOT merge unrelated sentences.
 * Boundaries: . ! ? followed by space or end.
 * @param {string} text
 * @returns {string[]}
 */
export function splitIntoSentences(text) {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Full preprocessing: normalize → merge broken lines → split sentences.
 * Returns flat array of sentences.
 * @param {string} text
 * @returns {string[]} Sentences to translate
 */
export function preprocessSentences(text) {
  const paragraphs = mergeBrokenLines(text);
  const sentences = [];
  for (const para of paragraphs) {
    if (!para) continue; // skip paragraph markers for translation
    const sents = splitIntoSentences(para);
    sentences.push(...sents);
  }
  return sentences.filter(Boolean);
}
