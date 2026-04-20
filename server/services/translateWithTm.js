import crypto from 'crypto';
import { getManyByHashAndLang, insertMany } from './translationMemory.js';
import { translateBatch } from './translationClient.js';
import { fluencyCorrectBatch } from './fluencyCorrection.js';

/**
 * Normalize text for consistent hashing (trim, collapse whitespace).
 */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * SHA-256 hash of normalized text.
 */
function hashText(text) {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Shared translation flow: normalize → hash → check TM → translate missing → store → merge.
 * Used by both URL and File modes. Batch missing texts before calling Python.
 * @param {string[]} texts - Raw source texts (order must be preserved)
 * @param {string} targetLang - NLLB language code (e.g. arb_Arab)
 * @returns {Promise<string[]>} Translated texts in same order
 */
export async function translateTextsWithTm(texts, targetLang) {
  if (texts.length === 0) return [];

  const normalized = texts.map(normalizeText);
  const hashes = normalized.map(hashText);

  const cached = await getManyByHashAndLang(hashes, targetLang);
  const result = new Array(texts.length);
  const missingIndices = [];
  const missingTexts = [];

  for (let i = 0; i < texts.length; i++) {
    const h = hashes[i];
    const fromCache = cached.get(h);
    if (fromCache != null) {
      result[i] = fromCache;
    } else {
      result[i] = null;
      missingIndices.push(i);
      missingTexts.push(normalized[i]);
    }
  }

  if (missingTexts.length > 0) {
    const translated = await translateBatch(missingTexts, targetLang);
    const fluent = await fluencyCorrectBatch(translated, targetLang);
    const toStore = [];
    for (let j = 0; j < missingIndices.length; j++) {
      const idx = missingIndices[j];
      const trans = fluent[j] ?? translated[j];
      result[idx] = trans;
      toStore.push({
        sourceText: missingTexts[j],
        sourceHash: hashes[idx],
        targetLang,
        translatedText: trans,
      });
    }
    await insertMany(toStore);
  }

  return result;
}

export { normalizeText, hashText };
