/**
 * POST /api/translate-file — Upload .properties only. Translate only values (key = value);
 * preserve keys, comments, blanks; placeholder protection; skip already-translated values.
 */

import express from 'express';
import multer from 'multer';
import { toNllbCode } from '../utils/langMap.js';
import { translatePipeline } from '../services/translatePipeline.js';
import {
  parsePropertiesFile,
  rebuildPropertiesFile,
  protectPlaceholders,
  restorePlaceholders,
  detectAlreadyTranslated,
} from '../services/fileProcessor.js';

const router = express.Router();

// JSON error responses are UTF-8 encoded.
router.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

/** Sanitize filename for Content-Disposition to prevent CRLF/quote injection. */
function safeDownloadFilename(name, opts = {}) {
  if (typeof name !== 'string') name = 'file';
  const base = (name || '').replace(/\.properties$/i, '').trim() || 'file';
  const safe = base.replace(/[\r\n"%\\]/g, '_').slice(0, 200);
  const locale = opts.locale ? String(opts.locale).replace(/[\r\n"%\\]/g, '_').slice(0, 20) : 'translated';
  return `${safe}-${locale}.properties`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.properties')) {
      cb(null, true);
    } else {
      cb(new Error('Only .properties files are allowed'), false);
    }
  },
});

router.post('/translate-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const targetLangRaw = req.body?.targetLang ?? req.body?.target_lang ?? req.query?.targetLang;
    if (!targetLangRaw) {
      return res.status(400).json({ error: 'Missing target language (targetLang)' });
    }
    const targetLang = toNllbCode(targetLangRaw);
    const originalName = req.file.originalname || '';

    // -----------------------------------------------------------------------
    // .properties: parse, translate only values, preserve keys/comments/blanks
    // -----------------------------------------------------------------------
    const parsed = parsePropertiesFile(req.file.buffer);
      const entriesToTranslate = [];
      const lineIndexToValue = new Map();

      for (let i = 0; i < parsed.length; i++) {
        const line = parsed[i];
        if (line.type !== 'entry') continue;
        const value = line.value ?? '';
        if (detectAlreadyTranslated(value, targetLang)) {
          lineIndexToValue.set(i, value);
          continue;
        }
        const { text: protectedText, placeholders } = protectPlaceholders(value);
        entriesToTranslate.push({
          lineIndex: i,
          originalValue: value,
          protectedText,
          placeholders,
        });
      }

      const textsToTranslate = entriesToTranslate.map((e) => e.protectedText);

      let translated = [];
      if (textsToTranslate.length > 0) {
        const result = await translatePipeline(textsToTranslate, targetLang);
        translated = result.translations ?? [];
        if (result.lowConfidenceIndices?.length > 0) {
          console.warn(
            'translate-file (.properties): low confidence entry indices',
            result.lowConfidenceIndices
          );
        }
      }

      entriesToTranslate.forEach((e, j) => {
        const raw = translated[j] ?? e.protectedText;
        const restored = restorePlaceholders(raw, e.placeholders);
        lineIndexToValue.set(e.lineIndex, restored);
      });

      for (let i = 0; i < parsed.length; i++) {
        const line = parsed[i];
        if (line.type === 'entry' && !lineIndexToValue.has(i)) {
          lineIndexToValue.set(i, line.value ?? '');
        }
      }

    const content = rebuildPropertiesFile(parsed, lineIndexToValue);
    const filename = safeDownloadFilename(originalName, { locale: targetLangRaw });
    // Convert to an explicit UTF-8 Buffer before sending so the wire encoding
    // is unambiguous regardless of Express version or platform defaults.
    const contentBuffer = Buffer.from(content, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', contentBuffer.length);
    res.send(contentBuffer);
  } catch (err) {
    console.error('translate-file error:', err.message);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

export default router;
