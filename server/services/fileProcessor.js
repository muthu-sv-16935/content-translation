/**
 * File processing: .txt (line-by-line) and .properties (key = value).
 * .txt: split by lines, translate non-empty lines, rebuild.
 * .properties: parse key=value, translate only values, preserve keys/comments/blanks, placeholder protection.
 */

// ---------------------------------------------------------------------------
// Target-language script ranges for "already translated" detection (Unicode)
// If value contains chars in the target script, we skip translation.
const SCRIPT_RANGES_BY_LANG = {
  tam_Taml: [/[\u0B80-\u0BFF]/], // Tamil
  arb_Arab: [/[\u0600-\u06FF]/, /[\u0750-\u077F]/], // Arabic
  tha_Thai: [/[\u0E00-\u0E7F]/], // Thai
  jpn_Jpan: [/[\u3040-\u309F]/, /[\u30A0-\u30FF]/, /[\u4E00-\u9FFF]/], // Hiragana, Katakana, CJK
  hin_Deva: [/[\u0900-\u097F]/], // Devanagari (Hindi)
  ben_Beng: [/[\u0980-\u09FF]/], // Bengali
  tel_Telu: [/[\u0C00-\u0C7F]/], // Telugu
  mar_Deva: [/[\u0900-\u097F]/], // Marathi (Devanagari)
  guj_Gujr: [/[\u0A80-\u0AFF]/], // Gujarati
  kan_Knda: [/[\u0C80-\u0CFF]/], // Kannada
  mal_Mlym: [/[\u0D00-\u0D7F]/], // Malayalam
  pan_Guru: [/[\u0A00-\u0A7F]/], // Gurmukhi (Punjabi)
  urd_Arab: [/[\u0600-\u06FF]/, /[\u0750-\u077F]/], // Urdu (Arabic)
};

/** Returns true if value appears to already be in the target language script. */
export function detectAlreadyTranslated(value, targetLang) {
  if (!value || typeof value !== 'string') return true;
  const ranges = SCRIPT_RANGES_BY_LANG[targetLang];
  if (!ranges || !Array.isArray(ranges)) return false;
  return ranges.some((re) => {
    const pattern = typeof re === 'string' ? new RegExp(re) : re;
    return pattern.test(value);
  });
}

// ---------------------------------------------------------------------------
// Placeholder protection: %d, %s, {0}, {1}, {name}, ${value}
const PLACEHOLDER_PATTERN =
  /(%[a-zA-Z@])|(\{[^}]+\})|(\$\{[^}]*\})/g;

/**
 * Replace placeholders in value with tokens; return protected text and mapping for restore.
 * @returns {{ text: string, placeholders: Array<{ token: string, original: string }> }}
 */
export function protectPlaceholders(value) {
  if (!value || typeof value !== 'string') return { text: value, placeholders: [] };
  const placeholders = [];
  const seen = new Map();
  let counter = 0;
  const text = value.replace(PLACEHOLDER_PATTERN, (match) => {
    let token = seen.get(match);
    if (!token) {
      token = `__PH${counter}__`;
      counter += 1;
      seen.set(match, token);
      placeholders.push({ token, original: match });
    }
    return token;
  });
  return { text, placeholders };
}

/**
 * Restore placeholders in translated text.
 *
 * Two-pass restoration to handle translation-model corruption of tokens:
 *
 * Pass 1 — fuzzy regex: match __\s*PH\s*<N>\s*__ so that space-corrupted
 *   variants (__ PH0__, __PH0 __, __ PH0 __) are all caught.  The captured
 *   index N is used to look up the original placeholder value (%d, %s, …).
 *
 * Pass 2 — exact split/join fallback: any token the regex did not normalise
 *   (because the model left it intact as __PH0__) is replaced by exact match.
 *   Running pass 2 after pass 1 is safe because pass 1 already replaced every
 *   variant, so exact tokens remaining after pass 1 are the genuine ones.
 *
 * The two passes together guarantee that all __PHn__-style tokens are removed
 * from the output regardless of what whitespace the model inserts.
 *
 * Does NOT touch HTML pipeline tokens (TAG_OPEN_N, TAG_CLOSE_N, BRAND_N, etc.)
 * because those use a completely different naming scheme.
 *
 * @param {string} text - Translated text (may contain corrupted tokens)
 * @param {Array<{ token: string, original: string }>} placeholders
 * @returns {string}
 */
export function restorePlaceholders(text, placeholders) {
  if (!text || typeof text !== 'string') return text;
  if (!placeholders || placeholders.length === 0) return text;

  // Build a fast index: numeric counter → original placeholder value.
  // token format is __PH<counter>__ so we extract the number.
  const indexToOriginal = new Map();
  for (const { token, original } of placeholders) {
    const m = token.match(/^__PH(\d+)__$/);
    if (m) indexToOriginal.set(Number(m[1]), original);
  }

  // Pass 1: fuzzy regex — tolerates spaces the model may insert inside the token.
  // Matches:  __PH0__   __ PH0__   __PH0 __   __ PH 0 __   etc.
  let result = text.replace(/__\s*PH\s*(\d+)\s*__/gi, (_, numStr) => {
    const idx = Number(numStr);
    return indexToOriginal.has(idx) ? indexToOriginal.get(idx) : _;
  });

  // Pass 2: exact match fallback for any token that survived pass 1 intact.
  // Sort longest-first to prevent __PH10__ being confused with __PH1__.
  const sorted = [...placeholders].sort((a, b) => b.token.length - a.token.length);
  for (const { token, original } of sorted) {
    if (result.includes(token)) {
      result = result.split(token).join(original);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// .properties parsing and rebuild

/**
 * @typedef {{ type: 'entry'|'comment'|'blank', key?: string, value?: string, raw: string }} PropertiesLine
 */

/**
 * Strip surrounding double-quotes from a string, e.g. '"foo"' → 'foo'.
 * Also strips a trailing semicolon that may follow the closing quote in
 * macOS .strings format ('\"value\";' → 'value').
 * Returns the original string unchanged when no surrounding quotes are present.
 * @param {string} s
 * @returns {string}
 */
function stripStringQuotes(s) {
  if (typeof s !== 'string') return s;
  // Remove optional trailing semicolon first (macOS .strings ends lines with ";")
  let v = s.endsWith(';') ? s.slice(0, -1).trimEnd() : s;
  // Strip surrounding double-quotes: "value" → value
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    v = v.slice(1, -1);
  }
  return v;
}

/**
 * Parse a .properties file buffer into lines (entry, comment, blank).
 *
 * Handles both Java .properties format:
 *   key = value
 * and macOS .strings format:
 *   "key" = "value";
 *
 * Surrounding double-quotes are stripped from keys and values so the
 * translation pipeline always works with bare strings.
 *
 * @param {Buffer} buffer
 * @returns {PropertiesLine[]}
 */
export function parsePropertiesFile(buffer) {
  const str = buffer.toString('utf8');
  const rawLines = str.split(/\r?\n/);
  const result = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      result.push({ type: 'blank', raw: line });
      continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('//')) {
      result.push({ type: 'comment', raw: line });
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      result.push({ type: 'comment', raw: line });
      continue;
    }
    // Strip surrounding quotes from both key and value (.strings compatibility)
    const key = stripStringQuotes(line.slice(0, eqIndex).trim());
    const value = stripStringQuotes(line.slice(eqIndex + 1).trim());
    result.push({ type: 'entry', key, value, raw: line });
  }
  return result;
}

/**
 * Rebuild .properties content from parsed lines and translated values.
 * @param {PropertiesLine[]} parsedLines
 * @param {Map<number, string>} lineIndexToValue - Map from line index to final value (translated or original)
 * @returns {string}
 */
export function rebuildPropertiesFile(parsedLines, lineIndexToValue) {
  const out = [];
  for (let i = 0; i < parsedLines.length; i++) {
    const p = parsedLines[i];
    if (p.type === 'blank' || p.type === 'comment') {
      out.push(p.raw);
      continue;
    }
    if (p.type === 'entry') {
      const value = lineIndexToValue.has(i) ? lineIndexToValue.get(i) : p.value;
      out.push(`${p.key} = ${value}`);
      continue;
    }
    out.push(p.raw);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// .txt (legacy)

/**
 * Process .txt file: split by lines, trim, ignore empty. Preserve order for rebuild.
 * @param {Buffer} buffer - File content
 * @returns {{ lines: string[], nonEmptyIndices: number[] }} lines and indices of non-empty lines (for rebuild)
 */
export function linesFromBuffer(buffer) {
  const str = buffer.toString('utf8');
  const rawLines = str.split(/\r?\n/);
  const lines = [];
  const nonEmptyIndices = [];
  rawLines.forEach((line, i) => {
    const trimmed = line.trim();
    lines.push(trimmed);
    if (trimmed.length > 0) {
      nonEmptyIndices.push(i);
    }
  });
  return { lines, nonEmptyIndices };
}

/**
 * Rebuild translated file: replace only non-empty lines with translations, preserve order and blanks.
 * @param {string[]} originalLines - All lines (including empty)
 * @param {number[]} nonEmptyIndices - Indices that were translated
 * @param {string[]} translatedTexts - Translations in same order as nonEmptyIndices
 * @returns {string} Full file content with translated lines
 */
export function rebuildTranslatedFile(originalLines, nonEmptyIndices, translatedTexts) {
  const result = [...originalLines];
  nonEmptyIndices.forEach((idx, j) => {
    result[idx] = translatedTexts[j] ?? originalLines[idx];
  });
  return result.join('\n');
}
