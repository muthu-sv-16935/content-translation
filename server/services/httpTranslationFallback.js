/**
 * Fallback translation via MyMemory (no API key). Used when Python NLLB service is not enabled.
 *
 * UTF-8 encoding strategy:
 * MyMemory returns its JSON body as UTF-8 but the HTTP response Content-Type is typically
 * "text/javascript" without a charset parameter.  Axios 1.x derives the decode encoding from
 * the Content-Type charset field; when no charset is present it may fall back to ISO-8859-1
 * (the HTTP spec default for text/*), turning multi-byte Tamil / Arabic / Japanese UTF-8
 * sequences into single-byte Latin-1 codepoints.  Node.js then holds those Latin-1
 * codepoints as JS string characters, and when Buffer.from(str, 'utf8') is called later
 * they get re-encoded as multi-byte UTF-8 sequences → "double-encoding".
 * The browser (or text editor) decodes the double-encoded bytes as UTF-8 and shows the
 * Latin-1 surrogates (à®à®©… instead of Tamil).
 *
 * Fix: use responseType:'arraybuffer' so Axios hands us the raw byte Buffer without
 * any string transcoding.  We then call Buffer.from(data).toString('utf8') ourselves,
 * which is guaranteed to interpret the bytes as UTF-8 regardless of any Content-Type header.
 *
 * Additionally, MyMemory sometimes HTML-entity-encodes its translated text
 * (e.g. "&#2965;&#2964;…" for Tamil). We normalise those with a lightweight decoder so
 * the .properties file always contains real Unicode characters.
 *
 * As a final belt-and-suspenders guard we also run fixMojibake() on every
 * response.  This catches any residual double-encoding that slips through
 * (e.g. when an upstream proxy re-encodes the body) without affecting
 * strings that are already correct Unicode.
 */

import axios from 'axios';

const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';

/**
 * Detect and repair "mojibake" — UTF-8 bytes that were decoded as Latin-1 and
 * then re-encoded as UTF-8.  Symptom: Tamil/Arabic/etc. appears as "à®à®©…".
 *
 * Heuristic (safe and cheap):
 *  1. If the string already has characters outside U+00FF it is correct Unicode → skip.
 *  2. If the string has no characters above U+007F it is plain ASCII → skip.
 *  3. Otherwise, re-interpret every character as a raw byte (Latin-1 semantics),
 *     decode the resulting Buffer as UTF-8, and accept the result only when it
 *     contains genuine non-Latin-1 Unicode (e.g. Tamil, Arabic, Devanagari).
 *
 * This is applied as a last resort after decodeHtmlEntities so that no matter
 * where mis-decoding originates the final string reaching the caller is correct.
 *
 * @param {string} str
 * @returns {string}
 */
function fixMojibake(str) {
  if (typeof str !== 'string') return str;
  // Already contains non-Latin-1 Unicode — correctly decoded, nothing to fix.
  if (/[^\u0000-\u00FF]/.test(str)) return str;
  // Pure ASCII — no multi-byte encoding possible.
  if (!/[\u0080-\u00FF]/.test(str)) return str;
  try {
    // Re-interpret each JS character as the byte whose value equals its code point.
    const bytes = Buffer.alloc(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    const decoded = bytes.toString('utf8');
    // Accept only when the UTF-8 interpretation yields genuine non-Latin-1 chars.
    if (/[\u0100-\uFFFF]/.test(decoded)) return decoded;
  } catch {
    // If decoding fails, return the original string unchanged.
  }
  return str;
}

/**
 * Decode HTML numeric entities (&#NNN; and &#xHHH;) in a string.
 * MyMemory occasionally returns Tamil / Arabic / other non-Latin text as entities.
 * We also decode common named entities (&amp; &lt; &gt; &quot; &apos;).
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** NLLB code -> MyMemory langpair target code (source is always "en") */
const NLLB_TO_ISO = {
  spa_Latn: 'es',
  por_Latn: 'pt',
  nld_Latn: 'nl',
  deu_Latn: 'de',
  ind_Latn: 'id',
  fra_Latn: 'fr',
  arb_Arab: 'ar',
  tha_Thai: 'th',
  jpn_Jpan: 'ja',
  vie_Latn: 'vi',
  hin_Deva: 'hi',
  ben_Beng: 'bn',
  tel_Telu: 'te',
  mar_Deva: 'mr',
  tam_Taml: 'ta',
  guj_Gujr: 'gu',
  urd_Arab: 'ur',
  kan_Knda: 'kn',
  mal_Mlym: 'ml',
  pan_Guru: 'pa',
};

function toMyMemoryLang(nllbCode) {
  if (!nllbCode || typeof nllbCode !== 'string') return 'es';
  return NLLB_TO_ISO[nllbCode] || nllbCode.split('_')[0]?.slice(0, 2) || 'es';
}

async function translateOne(text, targetLang) {
  const target = toMyMemoryLang(targetLang);
  const langpair = `en|${target}`;

  // Use responseType:'arraybuffer' to receive the raw byte buffer from MyMemory.
  // We then decode it ourselves as UTF-8, bypassing Axios's Content-Type charset
  // detection which can fall back to ISO-8859-1 for text/javascript responses and
  // corrupt multi-byte Tamil / Arabic / Japanese characters.
  const { data: rawBuffer } = await axios.get(MYMEMORY_BASE, {
    params: { q: text, langpair },
    timeout: 15000,
    validateStatus: (s) => s === 200,
    responseType: 'arraybuffer',
  });

  // Decode the raw bytes as UTF-8, then parse JSON.
  let parsed;
  try {
    const jsonText = Buffer.from(rawBuffer).toString('utf8');
    parsed = JSON.parse(jsonText);
  } catch {
    return text;
  }

  const translated = parsed?.responseData?.translatedText;
  if (translated == null) return text;

  // Decode any HTML entities MyMemory may have embedded in the translated text,
  // then repair any residual UTF-8/Latin-1 mojibake.
  return fixMojibake(decodeHtmlEntities(translated));
}

/**
 * Translate a batch of texts via MyMemory (sequential to avoid rate limits).
 * @param {string[]} texts - Source texts (order preserved)
 * @param {string} targetLang - NLLB language code (e.g. spa_Latn)
 * @returns {Promise<string[]>} Translated texts in same order
 */
export async function translateBatchViaHttp(texts, targetLang) {
  if (!texts || texts.length === 0) return [];
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 150));
    const text = texts[i];
    const t = String(text || '').trim();
    if (t === '') {
      results.push('');
      continue;
    }
    const translated = await translateOne(t.slice(0, 400), targetLang);
    results.push(translated);
  }
  return results;
}
