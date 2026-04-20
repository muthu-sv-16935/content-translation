/**
 * UI Tone Normalizer — rewrite short translated UI commands into a natural,
 * user-friendly tone for product UIs (buttons, menus, commands).
 *
 * Applied as the final step in translatePipeline after brand restoration and retry,
 * so every translation — including retried ones — gets normalized before being returned.
 *
 * UI command detection (evaluated on the English SOURCE string):
 *   - word count ≤ 4
 *   - character length ≤ 40
 *   - no sentence-terminal punctuation (. ! ?)
 * Using the source makes detection language-independent.
 *
 * Placeholder protection:
 *   - Value-style placeholders (%d, %s, %1$s, {0}, ${var}, {{var}}) → UITONE_TOKEN_N
 *   - Existing pipeline tokens (TAG_OPEN_N, TAG_CLOSE_N, BRAND_N, FLUENCY_TOKEN_N, __PHn__)
 *     are left untouched and must be returned verbatim by the backend.
 *
 * Python backend: POST /ui-tone-normalize
 *   Request:  { sentences: string[], sources: string[], target_lang: string }
 *   Response: { sentences: string[] }
 *   The backend rewrites each sentence using an LLM with a UI-tone prompt.
 *   Current Python stub returns sentences unchanged.
 *
 * Enable: USE_UI_TONE_NORMALIZATION=true in server/.env
 * Default (disabled): zero overhead — translations are returned as-is.
 */

import { uiToneNormalizeBatchViaPython } from './translationClient.js';

// ── Detection thresholds ─────────────────────────────────────────────────────

const MAX_UI_COMMAND_WORDS = 4;
const MAX_UI_COMMAND_CHARS = 40;
const UI_TONE_TIMEOUT_MS = 30000;

// ── Placeholder patterns ─────────────────────────────────────────────────────

/**
 * Value-style placeholders to protect before the backend call.
 * Same set as fluencyCorrection.js.
 */
const UITONE_PLACEHOLDER_PATTERN =
  /(%\d+\$[a-zA-Z@])|(%[a-zA-Z@])|(\{\{[^}]+\}\})|(\$\{[^}]*\})|(\{[^}]+\})/g;

/**
 * Existing pipeline tokens that must not be re-tokenized.
 * Any token matching this is left exactly as-is.
 */
const EXISTING_TOKEN_PATTERN =
  /^(TAG_OPEN_\d+|TAG_CLOSE_\d+|BRAND_\d+|FLUENCY_TOKEN_\d+|__PH\d+__)$/;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect whether the English source string is a short UI command.
 * Detection is based on source only so it is language-independent.
 *
 * NOT a UI command if:
 *   - Ends with . ! ? (sentence / paragraph)
 *   - More than 4 words
 *   - More than 40 characters
 *
 * @param {string} source
 * @returns {boolean}
 */
function isUiCommand(source) {
  if (!source || typeof source !== 'string') return false;
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > MAX_UI_COMMAND_WORDS) return false;
  if (trimmed.length > MAX_UI_COMMAND_CHARS) return false;
  return true;
}

/**
 * Replace value-style placeholders with UITONE_TOKEN_N so the backend cannot alter them.
 * Existing pipeline tokens (TAG_OPEN_N, BRAND_N, etc.) are never replaced.
 *
 * @param {string} text
 * @returns {{ text: string, placeholders: Array<{ token: string, original: string }> }}
 */
function protectPlaceholders(text) {
  if (!text || typeof text !== 'string') return { text: String(text || ''), placeholders: [] };
  const placeholders = [];
  const seen = new Map();
  let counter = 0;
  const result = text.replace(UITONE_PLACEHOLDER_PATTERN, (match) => {
    if (EXISTING_TOKEN_PATTERN.test(match)) return match;
    let token = seen.get(match);
    if (!token) {
      token = `UITONE_TOKEN_${counter}`;
      counter += 1;
      seen.set(match, token);
      placeholders.push({ token, original: match });
    }
    return token;
  });
  return { text: result, placeholders };
}

/**
 * Restore UITONE_TOKEN_N placeholders to their originals.
 * Processes longest tokens first to avoid partial replacement.
 *
 * @param {string} text
 * @param {Array<{ token: string, original: string }>} placeholders
 * @returns {string}
 */
function restorePlaceholders(text, placeholders) {
  if (!text || typeof text !== 'string') return text;
  if (!placeholders || placeholders.length === 0) return text;
  let result = text;
  const sorted = [...placeholders].sort((a, b) => b.token.length - a.token.length);
  for (const { token, original } of sorted) {
    result = result.split(token).join(original);
  }
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Normalize UI tone for a batch of translated strings.
 *
 * Only strings whose SOURCE is a UI command (≤4 words, ≤40 chars, no terminal
 * punctuation) are sent to the backend; all others pass through unchanged.
 *
 * @param {string[]} translations - Translated texts (post-brand-restore, post-retry)
 * @param {string[]} sources      - Original English source texts (same order as translations)
 * @param {string}   targetLang   - NLLB language code (e.g. tam_Taml)
 * @returns {Promise<string[]>}   - Tone-normalized translations (same order and length)
 */
export async function normalizeUiToneBatch(translations, sources, targetLang) {
  if (!translations || translations.length === 0) return translations || [];

  const useUiTone =
    process.env.USE_UI_TONE_NORMALIZATION === 'true' ||
    process.env.USE_UI_TONE_NORMALIZATION === '1';

  if (!useUiTone) return translations;

  const result = [...translations];
  const toNormalize = [];       // protected translation strings for backend
  const toNormalizeIndices = []; // positions in result[]
  const sourcesForBatch = [];   // matching source strings
  const placeholderMaps = [];   // placeholder maps per entry

  for (let i = 0; i < translations.length; i++) {
    const src = sources ? sources[i] : null;
    if (!isUiCommand(src)) continue;

    const t = translations[i];
    if (!t || !t.trim()) continue;

    const { text: protectedText, placeholders } = protectPlaceholders(t);
    toNormalize.push(protectedText);
    toNormalizeIndices.push(i);
    sourcesForBatch.push(src);
    placeholderMaps.push(placeholders);
  }

  if (toNormalize.length === 0) return result;

  try {
    const normalized = await Promise.race([
      uiToneNormalizeBatchViaPython(toNormalize, sourcesForBatch, targetLang),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('UI tone normalization timeout')),
          UI_TONE_TIMEOUT_MS
        )
      ),
    ]);

    if (
      normalized &&
      Array.isArray(normalized) &&
      normalized.length === toNormalize.length
    ) {
      toNormalizeIndices.forEach((idx, j) => {
        const restored = restorePlaceholders(
          normalized[j] ?? toNormalize[j],
          placeholderMaps[j]
        );
        result[idx] = restored;
      });
    }
  } catch (err) {
    console.warn(
      '[uiToneNormalizer] Skipped or failed:',
      err?.message || err,
      '- using original translations.'
    );
  }

  return result;
}
