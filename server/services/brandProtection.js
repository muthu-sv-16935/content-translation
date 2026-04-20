/**
 * Brand name protection: replace brands with tokens before translation,
 * restore after translation. Supports dynamic brand list.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BRANDS = [
  'Zoho Show',
  'WorkDrive',
  'Office Suite',
  'Zoho One',
  'Cliq',
  'Meeting',
];

let BRAND_NAMES = [...DEFAULT_BRANDS];

try {
  const brandsPath = join(__dirname, '../../data/brands.json');
  const data = JSON.parse(readFileSync(brandsPath, 'utf8'));
  if (Array.isArray(data.brands)) BRAND_NAMES = data.brands;
} catch {
  // Use defaults if file missing
}

const TOKEN_PREFIX = 'BRAND_';
const TOKEN_SUFFIX = '';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace brand names with placeholder tokens.
 * @param {string} text
 * @returns {{ text: string, replacements: Array<{ token: string, original: string }> }}
 */
export function replaceBrandsWithTokens(text) {
  if (typeof text !== 'string') return { text: '', replacements: [] };
  let result = text;
  const replacements = [];

  BRAND_NAMES.forEach((brand, i) => {
    const regex = new RegExp(`\\b(${escapeRegex(brand)})\\b`, 'gi');
    const token = `${TOKEN_PREFIX}${i}${TOKEN_SUFFIX}`;
    result = result.replace(regex, (match) => {
      replacements.push({ token, original: match });
      return token;
    });
  });

  return { text: result, replacements };
}

/**
 * Restore brand names from tokens in translated text.
 * @param {string} translatedText
 * @param {Array<{ token: string, original: string }>} replacements
 * @returns {string}
 */
export function restoreBrandsFromTokens(translatedText, replacements) {
  if (typeof translatedText !== 'string') return '';
  let result = translatedText;
  replacements.forEach(({ token, original }) => {
    result = result.replace(new RegExp(escapeRegex(token), 'g'), original);
  });
  return result;
}

/**
 * Process a batch of texts: replace brands, return modified texts and replacement maps.
 * @param {string[]} texts
 * @returns {{ texts: string[], replacementMaps: Array<Array<{ token: string, original: string }>> }}
 */
export function replaceBrandsBatch(texts) {
  const modified = [];
  const replacementMaps = [];
  for (const text of texts) {
    const { text: modifiedText, replacements } = replaceBrandsWithTokens(text);
    modified.push(modifiedText);
    replacementMaps.push(replacements);
  }
  return { texts: modified, replacementMaps };
}

/**
 * Restore brands in a batch of translated texts.
 * @param {string[]} translatedTexts
 * @param {Array<Array<{ token: string, original: string }>>} replacementMaps
 * @returns {string[]}
 */
export function restoreBrandsBatch(translatedTexts, replacementMaps) {
  return translatedTexts.map((t, i) =>
    restoreBrandsFromTokens(t, replacementMaps[i] || [])
  );
}

export { BRAND_NAMES };
