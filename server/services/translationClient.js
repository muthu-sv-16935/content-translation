/**
 * Translation: uses MyMemory (HTTP) by default so the app works without any extra service.
 * Set USE_PYTHON_SERVICE=true and run the Python NLLB server on port 8000 to use it instead.
 */

import axios from 'axios';
import { translateBatchViaHttp } from './httpTranslationFallback.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
const USE_PYTHON_SERVICE = process.env.USE_PYTHON_SERVICE === 'true' || process.env.USE_PYTHON_SERVICE === '1';

/**
 * Translate a batch of texts.
 * Default: MyMemory only (no connection to 127.0.0.1:8000).
 * If USE_PYTHON_SERVICE=true: try Python first, then MyMemory on failure.
 */
export async function translateBatch(texts, targetLang) {
  if (!texts || texts.length === 0) return [];

  if (USE_PYTHON_SERVICE) {
    try {
      const { data } = await axios.post(
        `${PYTHON_SERVICE_URL}/translate-batch`,
        { texts, target_lang: targetLang },
        { timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity }
      );
      const translations = data?.translations ?? data;
      if (Array.isArray(translations)) return translations;
    } catch (err) {
      console.warn('Python translation service failed:', err?.code || err?.message || err, '- using MyMemory.');
    }
  }

  return translateBatchViaHttp(texts, targetLang);
}

/**
 * Call Python service fluency-correct endpoint. Used when USE_FLUENCY_CORRECTION=true.
 * @param {string[]} sentences - Texts with placeholders already protected as FLUENCY_TOKEN_N
 * @param {string} targetLang - NLLB language code
 * @returns {Promise<string[]>} Corrected sentences (same order and length)
 */
export async function fluencyCorrectBatchViaPython(sentences, targetLang) {
  if (!sentences || sentences.length === 0) return sentences || [];
  const url = `${PYTHON_SERVICE_URL}/fluency-correct`;
  const { data } = await axios.post(
    url,
    { sentences, target_lang: targetLang },
    { timeout: 30000, maxContentLength: Infinity, maxBodyLength: Infinity }
  );
  const out = data?.sentences ?? data;
  if (Array.isArray(out) && out.length === sentences.length) return out;
  throw new Error('Fluency correction returned invalid response');
}

/**
 * Call Python service ui-tone-normalize endpoint. Used when USE_UI_TONE_NORMALIZATION=true.
 * Only short UI command strings are sent (filtering is done by the caller).
 * @param {string[]} sentences   - Translated UI strings (value placeholders protected as UITONE_TOKEN_N)
 * @param {string[]} sources     - Matching English source strings (used for LLM context)
 * @param {string}   targetLang  - NLLB language code
 * @returns {Promise<string[]>}  - Tone-normalized sentences (same order and length)
 */
export async function uiToneNormalizeBatchViaPython(sentences, sources, targetLang) {
  if (!sentences || sentences.length === 0) return sentences || [];
  const url = `${PYTHON_SERVICE_URL}/ui-tone-normalize`;
  const { data } = await axios.post(
    url,
    { sentences, sources: sources ?? [], target_lang: targetLang },
    { timeout: 30000, maxContentLength: Infinity, maxBodyLength: Infinity }
  );
  const out = data?.sentences ?? data;
  if (Array.isArray(out) && out.length === sentences.length) return out;
  throw new Error('UI tone normalization returned invalid response');
}
