/**
 * Map frontend language codes to NLLB codes (must match client langMap).
 */
const CODE_TO_NLLB = {
  es: 'spa_Latn',
  'pt-BR': 'por_Latn',
  nl: 'nld_Latn',
  de: 'deu_Latn',
  id: 'ind_Latn',
  fr: 'fra_Latn',
  ar: 'arb_Arab',
  th: 'tha_Thai',
  ja: 'jpn_Jpan',
  vi: 'vie_Latn',
  // Indian languages
  hi: 'hin_Deva',
  bn: 'ben_Beng',
  te: 'tel_Telu',
  mr: 'mar_Deva',
  ta: 'tam_Taml',
  gu: 'guj_Gujr',
  ur: 'urd_Arab',
  kn: 'kan_Knda',
  ml: 'mal_Mlym',
  pa: 'pan_Guru',
};

export function toNllbCode(value) {
  if (!value || typeof value !== 'string') return value;
  if (value.includes('_')) return value;
  return CODE_TO_NLLB[value] ?? value;
}
