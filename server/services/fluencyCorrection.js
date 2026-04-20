/**
 * Fluency correction: rewrite translated segments for naturalness, grammar,
 * and user-friendly UI tone while preserving meaning and placeholders.
 * Used after NLLB/MyMemory, before TM store.
 *
 * This single post-translation step is responsible for:
 *  - Improving sentence flow and word order (fluency).
 *  - Fixing literal translations, punctuation, and language-specific grammar.
 *  - Ensuring translations are concise, polite, and appropriate for product UI.
 *
 * When USE_FLUENCY_CORRECTION=true the batch is sent to the Python
 * /fluency-correct endpoint.  The Python side must preserve every FLUENCY_TOKEN_N
 * placeholder and can implement fluency + grammar + tone via an LLM prompt or a
 * separate naturalness model.  Until a real backend is wired up, the Python stub
 * returns sentences unchanged.
 *
 * Placeholder handling:
 *  - Protects value-style placeholders (%d, %s, %1$s, {0}, ${x}, {{y}}) as FLUENCY_TOKEN_N.
 *  - Does NOT touch existing pipeline tokens (TAG_OPEN_N, TAG_CLOSE_N, BRAND_N, __PHn__).
 *  - Skips segments with word count ≤ 2 (short UI strings handled by glossary).
 */

import { fluencyCorrectBatchViaPython } from './translationClient.js';

const MIN_WORDS_FOR_FLUENCY = 3;
const FLUENCY_TIMEOUT_MS = 60000;

/**
 * Covers:
 *  %d  %s  %n  %@  (standard printf)
 *  %1$s  %2$d  (positional printf)
 *  {0}  {1}  {username}  (MessageFormat / named)
 *  ${value}  ${account}  (Spring / template literal style)
 *  {{variable}}  (Handlebars / double-brace)
 * Does NOT match existing pipeline tokens (tested separately via EXISTING_TOKEN_PATTERN).
 */
const FLUENCY_PLACEHOLDER_PATTERN =
  /(%\d+\$[a-zA-Z@])|(%[a-zA-Z@])|(\{\{[^}]+\}\})|(\$\{[^}]*\})|(\{[^}]+\})/g;

const EXISTING_TOKEN_PATTERN =
  /^(TAG_OPEN_\d+|TAG_CLOSE_\d+|BRAND_\d+|__PH\d+__)$/;

function wordCount(text) {
  if (typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Protect value-style placeholders with FLUENCY_TOKEN_N so the fluency backend does not alter them.
 * Leaves existing pipeline tokens (TAG_OPEN_N, BRAND_N, __PHn__) unchanged.
 * @returns {{ text: string, placeholders: Array<{ token: string, original: string }> }}
 */
function protectPlaceholdersForFluency(text) {
  if (!text || typeof text !== 'string') return { text: String(text || ''), placeholders: [] };
  const placeholders = [];
  const seen = new Map();
  let counter = 0;
  const result = text.replace(FLUENCY_PLACEHOLDER_PATTERN, (match) => {
    if (EXISTING_TOKEN_PATTERN.test(match)) return match;
    let token = seen.get(match);
    if (!token) {
      token = `FLUENCY_TOKEN_${counter}`;
      counter += 1;
      seen.set(match, token);
      placeholders.push({ token, original: match });
    }
    return token;
  });
  return { text: result, placeholders };
}

/**
 * Restore FLUENCY_TOKEN_N with original placeholders (longest token first).
 */
function restorePlaceholdersAfterFluency(text, placeholders) {
  if (!text || typeof text !== 'string') return text;
  if (!placeholders || placeholders.length === 0) return text;
  let result = text;
  const sorted = [...placeholders].sort((a, b) => b.token.length - a.token.length);
  for (const { token, original } of sorted) {
    result = result.split(token).join(original);
  }
  return result;
}

/**
 * Run fluency correction on a batch of translated texts.
 * - Skips segments with word count <= 2.
 * - Protects placeholders, calls backend, restores placeholders.
 * - On disable or error, returns original segments.
 * @param {string[]} texts - Translated segments (same order as pipeline)
 * @param {string} targetLang - NLLB language code
 * @returns {Promise<string[]>} Fluency-corrected segments (same order and length)
 */
export async function fluencyCorrectBatch(texts, targetLang) {
  if (!texts || texts.length === 0) return texts || [];

  const useFluency =
    process.env.USE_FLUENCY_CORRECTION === 'true' ||
    process.env.USE_FLUENCY_CORRECTION === '1';

  if (!useFluency) return texts;

  const result = [...texts];
  const toCorrect = [];
  const toCorrectIndices = [];
  const placeholderMaps = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (wordCount(t) <= MIN_WORDS_FOR_FLUENCY) continue;
    const { text: protectedText, placeholders } = protectPlaceholdersForFluency(t);
    toCorrect.push(protectedText);
    toCorrectIndices.push(i);
    placeholderMaps.push(placeholders);
  }

  if (toCorrect.length === 0) return result;

  try {
    const corrected = await Promise.race([
      fluencyCorrectBatchViaPython(toCorrect, targetLang),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Fluency correction timeout')),
          FLUENCY_TIMEOUT_MS
        )
      ),
    ]);

    if (corrected && Array.isArray(corrected) && corrected.length === toCorrect.length) {
      toCorrectIndices.forEach((idx, j) => {
        const restored = restorePlaceholdersAfterFluency(
          corrected[j] ?? toCorrect[j],
          placeholderMaps[j]
        );
        result[idx] = restored;
      });
    }
  } catch (err) {
    console.warn(
      'Fluency correction skipped or failed:',
      err?.message || err,
      '- using original translations.'
    );
  }

  return result;
}
