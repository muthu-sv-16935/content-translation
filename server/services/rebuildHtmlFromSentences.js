/**
 * Rebuild HTML after translation.
 *
 * Takes the Cheerio instance `$`, the original `segments` produced by
 * `extractSentenceSegments`, and an array of `translations`. It then
 * mutates the DOM in-place by updating:
 *   - <title> text
 *   - meta[name="description"] content
 *   - leaf block innerHTML (placeholder tokens replaced with original inline tags)
 *
 * All HTML structure and attributes are preserved via the placeholder mapping.
 */

/**
 * Replace all placeholder keys in text with their tag strings.
 * Uses longest-key-first so TAG_OPEN_10 is replaced before TAG_OPEN_1.
 */
function restorePlaceholders(text, tagMap) {
  if (!text || typeof text !== 'string') return text;
  if (!tagMap || typeof tagMap !== 'object') return text;
  const keys = Object.keys(tagMap).filter((k) => k && tagMap[k] != null);
  if (keys.length === 0) return text;
  keys.sort((a, b) => b.length - a.length);
  let result = text;
  for (const key of keys) {
    result = result.split(key).join(tagMap[key]);
  }
  return result;
}

/**
 * @param {*} $ - Cheerio root instance
 * @param {Array} segments - Array produced by extractSentenceSegments
 * @param {Array<string>} translations - Translated texts, same length/order as segments
 */
export function rebuildHtmlFromSentences($, segments, translations) {
  if (!$ || typeof $.root !== 'function') {
    throw new Error('rebuildHtmlFromSentences: invalid Cheerio instance');
  }
  if (!Array.isArray(segments) || !Array.isArray(translations)) {
    throw new Error('rebuildHtmlFromSentences: segments and translations must be arrays');
  }
  if (segments.length !== translations.length) {
    // eslint-disable-next-line no-console
    console.error(
      'rebuildHtmlFromSentences: segments/translations length mismatch',
      segments.length,
      translations.length
    );
    throw new Error('Segments/translations length mismatch');
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] || {};
    let translated = translations[i];

    if (typeof translated !== 'string') {
      translated = typeof seg.text === 'string' ? seg.text : '';
    }

    switch (seg.kind) {
      case 'title': {
        try {
          const el = seg.elementRef;
          if (el) {
            const $title = $(el);
            if ($title && $title.length > 0) {
              $title.text(translated);
              break;
            }
          }
          const $titleFallback = $('head title').first();
          if ($titleFallback.length > 0) {
            $titleFallback.text(translated);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('rebuildHtmlFromSentences: failed to update <title>:', err?.message);
        }
        break;
      }

      case 'meta-description': {
        try {
          const el = seg.elementRef;
          if (el) {
            const $meta = $(el);
            if ($meta && $meta.length > 0) {
              $meta.attr('content', translated);
              break;
            }
          }
          const $metaFallback = $('meta[name="description"]').first();
          if ($metaFallback.length > 0) {
            $metaFallback.attr('content', translated);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            'rebuildHtmlFromSentences: failed to update meta[name="description"]:',
            err?.message
          );
        }
        break;
      }

      case 'block': {
        const blockRef = seg.blockRef;
        const tagMap = seg.tagMap;
        if (!blockRef) {
          // eslint-disable-next-line no-console
          console.warn('rebuildHtmlFromSentences: block segment missing blockRef');
          break;
        }
        const html = restorePlaceholders(translated, tagMap || {});
        try {
          const $block = $(blockRef);
          if ($block && $block.length > 0) {
            $block.html(html);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('rebuildHtmlFromSentences: failed to set block innerHTML:', err?.message);
        }
        break;
      }

      default:
        break;
    }
  }
}
