/**
 * Quality validation for translations.
 * - BLEU scoring (reference-free: use source as proxy)
 * - chrF++ (character n-gram F-score)
 * - Semantic similarity (optional, requires embedding model)
 * - Confidence threshold: flag if < 0.85
 */

const CONFIDENCE_THRESHOLD = (() => {
  const v = parseFloat(process.env.TRANSLATION_CONFIDENCE_THRESHOLD);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.85;
})();

/**
 * Simple BLEU-like score: n-gram overlap.
 * For reference-free: use source as "reference" for structure check.
 * Returns 0–1.
 * @param {string} candidate
 * @param {string} reference
 * @returns {number}
 */
function computeNgramOverlap(candidate, reference) {
  if (!candidate || !reference) return 0;
  const words = candidate.trim().split(/\s+/).filter(Boolean);
  const refWords = reference.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || refWords.length === 0) return 0;
  const refSet = new Set(refWords.map((w) => w.toLowerCase()));
  let matches = 0;
  for (const w of words) {
    if (refSet.has(w.toLowerCase())) matches++;
  }
  const precision = matches / words.length;
  const recall = matches / refWords.length;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Character n-gram F-score (simplified chrF).
 * @param {string} candidate
 * @param {string} reference
 * @param {number} n
 * @returns {number}
 */
function computeChrF(candidate, reference, n = 4) {
  if (!candidate || !reference) return 0;
  const getNgrams = (s) => {
    const ng = new Map();
    for (let i = 0; i <= s.length - n; i++) {
      const g = s.slice(i, i + n).toLowerCase();
      ng.set(g, (ng.get(g) || 0) + 1);
    }
    return ng;
  };
  const candNgrams = getNgrams(candidate);
  const refNgrams = getNgrams(reference);
  let matches = 0;
  let candTotal = 0;
  candNgrams.forEach((count, gram) => {
    candTotal += count;
    const refCount = refNgrams.get(gram) || 0;
    matches += Math.min(count, refCount);
  });
  const refTotal = [...refNgrams.values()].reduce((a, b) => a + b, 0);
  if (candTotal === 0 || refTotal === 0) return 0;
  const precision = matches / candTotal;
  const recall = matches / refTotal;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Length ratio penalty: penalize if translation is too short or too long.
 * @param {string} source
 * @param {string} translated
 * @returns {number} 0–1
 */
function lengthRatioScore(source, translated) {
  const sWords = source.trim().split(/\s+/).filter(Boolean).length;
  const tWords = translated.trim().split(/\s+/).filter(Boolean).length;
  if (sWords === 0) return 1;
  const ratio = tWords / sWords;
  if (ratio >= 0.5 && ratio <= 2.0) return 1;
  if (ratio < 0.3 || ratio > 3.0) return 0.3;
  return 0.7;
}

/**
 * Validate a single translation.
 * @param {string} source
 * @param {string} translated
 * @returns {{ bleu: number, chrf: number, lengthScore: number, confidence: number, flagged: boolean }}
 */
export function validateTranslation(source, translated) {
  const bleu = computeNgramOverlap(translated, source);
  const chrf = computeChrF(translated, source);
  const lengthScore = lengthRatioScore(source, translated);

  const confidence = bleu * 0.35 + chrf * 0.35 + lengthScore * 0.3;
  const flagged = confidence < CONFIDENCE_THRESHOLD;

  return {
    bleu,
    chrf,
    lengthScore,
    confidence,
    flagged,
  };
}

/**
 * Validate a batch of translations.
 * @param {string[]} sources
 * @param {string[]} translated
 * @returns {Array<{ bleu: number, chrf: number, lengthScore: number, confidence: number, flagged: boolean }>}
 */
export function validateBatch(sources, translated) {
  return sources.map((s, i) => validateTranslation(s, translated[i] || ''));
}

/**
 * Get indices of low-confidence translations.
 * @param {string[]} sources
 * @param {string[]} translated
 * @returns {number[]}
 */
export function getLowConfidenceIndices(sources, translated) {
  const results = validateBatch(sources, translated);
  return results.reduce((acc, r, i) => (r.flagged ? [...acc, i] : acc), []);
}

export { CONFIDENCE_THRESHOLD };
