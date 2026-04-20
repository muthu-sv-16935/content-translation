/**
 * Production translation pipeline: brand protection, glossary, sentence-level
 * translation for long paragraphs, validation with retry.
 */

import { replaceBrandsBatch, restoreBrandsBatch, restoreBrandsFromTokens } from './brandProtection.js';
import { glossaryTranslateBatch } from './glossary.js';
import { splitIntoSentences } from './preprocess.js';
import { translateTextsWithTm } from './translateWithTm.js';
import { getLowConfidenceIndices } from './validation.js';
import { normalizeUiToneBatch } from './uiToneNormalizer.js';

const LONG_PARAGRAPH_THRESHOLD = 120;

function shouldSplitIntoSentences(text) {
  if (!text || text.length < LONG_PARAGRAPH_THRESHOLD) return false;
  const sentences = splitIntoSentences(text);
  return sentences.length > 1;
}

/**
 * Expand long texts into sentences for translation, track mapping for collapse.
 */
function expandLongTexts(texts) {
  const flat = [];
  const mapping = [];

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (shouldSplitIntoSentences(t)) {
      const sents = splitIntoSentences(t);
      flat.push(...sents);
      mapping.push({ type: 'multi', start: flat.length - sents.length, count: sents.length });
    } else {
      flat.push(t);
      mapping.push({ type: 'single', idx: flat.length - 1 });
    }
  }
  return { flat, mapping };
}

function collapseTranslations(flatTranslations, mapping) {
  const result = [];
  for (const m of mapping) {
    if (m.type === 'single') {
      result.push(flatTranslations[m.idx] ?? '');
    } else {
      const parts = flatTranslations.slice(m.start, m.start + m.count);
      result.push(parts.join(' ').trim());
    }
  }
  return result;
}

/**
 * Run full pipeline with retry on low confidence.
 */
export async function translatePipeline(texts, targetLang) {
  if (!texts || texts.length === 0) {
    return { translations: [], lowConfidenceIndices: [] };
  }

  // 1. Brand protection
  const { texts: brandedTexts, replacementMaps } = replaceBrandsBatch(texts);

  // 2. Glossary lookup for short UI strings (≤2 words, ≤30 chars) and pattern templates
  const { translated, toTranslateIndices } = glossaryTranslateBatch(
    brandedTexts,
    targetLang
  );

  // 3. Expand long paragraphs into sentences
  const toTranslate = toTranslateIndices.map((i) => brandedTexts[i]);
  const { flat, mapping } = expandLongTexts(toTranslate);

  // 4. NLLB + TM (with retry on low confidence)
  let nllbResults = [];
  if (flat.length > 0) {
    nllbResults = await translateTextsWithTm(flat, targetLang);
  }

  const collapsed = collapseTranslations(nllbResults, mapping);
  toTranslateIndices.forEach((idx, j) => {
    translated[idx] = collapsed[j] ?? brandedTexts[toTranslateIndices[j]];
  });

  // 5. Restore brands
  const finalTranslations = restoreBrandsBatch(translated, replacementMaps);

  // 6. Validation: flag low confidence
  const lowConfidenceIndices = getLowConfidenceIndices(texts, finalTranslations);

  // 7. Retry once for low-confidence segments
  if (lowConfidenceIndices.length > 0) {
    const retryTexts = lowConfidenceIndices.map((i) => brandedTexts[i]);
    const retryTranslated = await translateTextsWithTm(retryTexts, targetLang);
    lowConfidenceIndices.forEach((idx, j) => {
      finalTranslations[idx] = restoreBrandsFromTokens(
        retryTranslated[j] ?? finalTranslations[idx],
        replacementMaps[idx] || []
      );
    });
  }

  // 8. UI Tone Normalization — short UI commands only (≤4 source words, ≤40 chars,
  //    no terminal punctuation). Runs after all retries so every final translation
  //    is tone-normalized. No-op when USE_UI_TONE_NORMALIZATION is not set.
  const toneNormalized = await normalizeUiToneBatch(finalTranslations, texts, targetLang);

  return {
    translations: toneNormalized,
    lowConfidenceIndices,
  };
}
