/**
 * POST /api/translate-url — Fetch URL (axios), extract, translate, return rebuilt HTML.
 */

import express from 'express';
import prettier from 'prettier';
import * as cheerio from 'cheerio';
import { toNllbCode } from '../utils/langMap.js';
import { isAllowedUrl } from '../utils/urlValidation.js';
import { fetchPage } from '../services/fetchPage.js';
import { extractSentenceSegments } from '../services/extractSentences.js';
import { rebuildHtmlFromSentences } from '../services/rebuildHtmlFromSentences.js';
import { applyRtlSupport } from '../services/rtlHandler.js';
import { translatePipeline } from '../services/translatePipeline.js';

const router = express.Router();

// All responses from this router are JSON encoded as UTF-8.
router.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

function buildHtml(ch) {
  return ch.html() || '';
}

router.post('/translate-url', async (req, res) => {
  try {
    const { url, targetLang: targetLangRaw } = req.body ?? {};
    if (!targetLangRaw) {
      return res.status(400).json({ error: 'Missing targetLang' });
    }
    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }
    const urlCheck = isAllowedUrl(url);
    if (!urlCheck.allowed) {
      return res.status(400).json({ error: urlCheck.error || 'Invalid url' });
    }
    const targetLang = toNllbCode(targetLangRaw);

    let rawSourceHtml;
    try {
      rawSourceHtml = await fetchPage(url.trim());
    } catch (fetchErr) {
      console.error('fetchPage error:', fetchErr.message);
      return res.status(502).json({
        error: fetchErr.message || 'Failed to fetch page',
      });
    }

    if (!rawSourceHtml || typeof rawSourceHtml !== 'string') {
      return res.status(502).json({ error: 'Invalid HTML received' });
    }

    let $, segments;
    try {
      const extracted = extractSentenceSegments(rawSourceHtml);
      $ = extracted.$;
      segments = extracted.segments;
    } catch (extractErr) {
      console.error('extractSentenceSegments error:', extractErr.message);
      return res.status(500).json({ error: 'Failed to parse HTML' });
    }

    if (!segments || segments.length === 0) {
      return res.json({
        sourceHtml: rawSourceHtml,
        translatedHtml: rawSourceHtml,
        rtl: targetLang === 'arb_Arab',
        warning: 'No translatable content found',
      });
    }

    const rawSourceHtmlStr = buildHtml($);

    const texts = segments.map((s) => s.text ?? '');

    let translations;
    try {
      const result = await translatePipeline(texts, targetLang);
      translations = result.translations;
      if (result.lowConfidenceIndices?.length > 0) {
        console.warn('Low confidence segments:', result.lowConfidenceIndices);
      }
    } catch (translateErr) {
      console.error('translatePipeline error:', translateErr.message);
      return res.status(500).json({
        error: translateErr.message || 'Translation failed',
      });
    }

    try {
      rebuildHtmlFromSentences($, segments, translations);
    } catch (rebuildErr) {
      console.error('rebuildHtmlFromSentences error:', rebuildErr.message);
      return res.status(500).json({ error: 'Failed to rebuild HTML' });
    }

    const rtl = targetLang === 'arb_Arab';
    const fullHtml = rtl ? applyRtlSupport($.html()) : $.html();
    const $final = cheerio.load(fullHtml, { decodeEntities: false });
    const rawTranslatedHtmlStr = buildHtml($final);

    const prettierOpts = { parser: 'html', printWidth: 100, htmlWhitespaceSensitivity: 'ignore' };
    const sourceHtml = await prettier.format(rawSourceHtmlStr, prettierOpts);
    const translatedHtml = await prettier.format(rawTranslatedHtmlStr, prettierOpts);

    res.json({ sourceHtml, translatedHtml, rtl });
  } catch (err) {
    console.error('translate-url error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

export default router;
