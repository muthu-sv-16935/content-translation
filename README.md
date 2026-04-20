# Webpage Translator

Full-stack app that translates **any website** and **Java .properties** UI files: fetch a URL or upload a `.properties` file, then get translated HTML or key-value content using a **translation pipeline** with optional NLLB (Python) or MyMemory fallback. The system is **structure-agnostic** (no product-specific selectors), preserves the **full HTML document** (head and body structure intact), and modifies **only visible textual content**: page title, meta description, and body block text. Includes Translation Memory (TM), brand protection, glossary for short UI strings, block-level translation with inline-tag placeholders (correct word order for languages like Tamil), optional fluency correction, validation with retry, and RTL support for Arabic.

---

## Features

- **Translate by URL** – Enter a webpage URL; only **http** and **https** are allowed (SSRF-safe). The server fetches HTML with Axios, extracts **title**, **meta description**, and **body** leaf blocks (skipping excluded and no-translate elements), runs the pipeline, and returns **full-document** source and translated HTML as raw code (no iframe).
- **Translate by file** – Upload a Java `.properties` file only (product UI: only values translated, keys and placeholders like `%d`/`{0}`/`{{var}}` preserved). Keys ending in `.plural` or `.singular` get a short context hint before translation so the model can choose correct grammar; hints are stripped from the output. Already-translated values (by target script heuristic) are skipped. Returns a translated file as `name-{locale}.properties` (e.g. `messages-ta.properties`). Brand protection, TM, and placeholder protection apply.
- **Full document preserved** – No structural elements are removed. **&lt;head&gt;** (meta charset, viewport, OpenGraph, link, script) and **&lt;body&gt;** stay intact. Only **&lt;title&gt;** text, **meta[name="description"]** content, and text inside safe block elements are modified.
- **Skip-on-traverse** – Elements such as `script`, `style`, `noscript`, `svg`, `canvas`, `iframe`, `code`, `pre`, `textarea` are **skipped during extraction** (not removed). Layout, CSS, and scripts remain in the output.
- **Generic extraction** – Root is `body`; no hardcoded classes. Respects no-translate markers (`.no-translate`, `data-translate="false"`, `translate="no"`).
- **Block-level + inline placeholders** – Each **leaf** block (p, div, li, td, th, h1–h6, section, article, blockquote, label) is translated as **one segment**. Inline tags (`a`, `span`, `strong`, `em`, `b`, `i`, `small`, `u`, `sup`, `sub`) are replaced with placeholder tokens (e.g. `TAG_OPEN_0`, `TAG_CLOSE_0`) before translation so the model sees the full sentence and can produce correct word order (e.g. Tamil); after translation, placeholders are restored to the original HTML tags and the block’s innerHTML is updated.
- **Safe sentence split** – Blocks longer than **800** characters are split only at `.!?` followed by space and an **uppercase letter**; not applied for Japanese, Thai, or Arabic script. If split yields one segment, the block is kept whole.
- **Large block protection** – Blocks over **3000** characters are split or **skipped with a warning**; very large strings are not sent to the model.
- **Translation pipeline** – Brand tokenization, glossary lookup for short UI strings (≤2 words, ≤30 chars) and optional pattern templates, TM lookup, NLLB or MyMemory, **fluency correction** (optional), validation with optional retry, brand restoration, then rebuild (title, meta description, block innerHTML with placeholder restore or fallback).
- **Translation Memory** – sql.js-backed cache keyed by source hash + target language; repeated segments are reused and stay consistent. (For horizontal scaling, TM can be migrated to PostgreSQL.)
- **RTL** – For Arabic (`ar`), the server sets `dir="rtl"` and `lang="ar"` on the HTML and injects RTL CSS.

---

## Architecture flow

End-to-end pipeline from input to translated output:

```
┌─────────────────┐     ┌─────────────────┐
│  URL (translate │     │  File (.properties)      │
│  by URL)        │     │  upload          │
└────────┬────────┘     └────────┬─────────┘
         │                        │
         ▼                        │
┌─────────────────────────────────────────┐
│  Fetch HTML (Axios) — URL path only      │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         │  Extract (URL path):  │  ← File path: split lines
         │  • Title              │
         │  • Meta description   │
         │  • Body leaf blocks   │
         │    (skip excluded tags; no DOM removal) │
         │  • Inline → placeholders (TAG_OPEN_N…)  │
         │  • One segment per block (full context)│
         │  • Block >800 chars → safe sentence split │
         │  • Block >3000 chars → split or skip     │
         └───────────┬───────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Preprocess + normalize                  │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Brand protection → Glossary → TM       │
│  → NLLB / MyMemory (missing only)        │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Fluency correction (optional)           │
│  • Skip if word count ≤ 2                │
│  • Preserve placeholders; store fluent   │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Validation + retry (low confidence)     │
│  Brand restoration                      │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Rebuild                                │
│  • Title text                           │
│  • Meta description content             │
│  • Blocks: concat → restore placeholders│
│    (or fallback to original if mismatch)│
│  → Full document (head + body)          │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│  Return full document (source/translated)│
└─────────────────────────────────────────┘
```

---

## HTML extraction & rebuild

| Aspect | Behavior |
|--------|----------|
| **Document** | **Full HTML is preserved.** No structural elements are removed. Only visible textual content in selected nodes is modified. |
| **Head** | **&lt;head&gt; remains intact.** Meta charset, viewport, OpenGraph, link, and script tags are **not** removed. Only **&lt;title&gt;** text and **meta[name="description"]** `content` are extracted and translated; all other head content is unchanged. |
| **Exclusions** | **Skip-on-traverse only.** Elements with tags `script`, `style`, `noscript`, `svg`, `canvas`, `iframe`, `code`, `pre`, `textarea` are **skipped** during block collection (blocks inside them are not translated). They are **never removed** from the DOM, so the output still contains all scripts, styles, and meta/link. |
| **No-translate** | Elements (or their subtree) with `.no-translate`, `[data-translate="false"]`, or `[translate="no"]` are skipped. |
| **Root** | `body` only. No product-specific selectors. Works for any site structure. |
| **Block-level** | Only **leaf** block elements are used as containers: `p`, `div`, `li`, `td`, `th`, `h1`–`h6`, `section`, `article`, `blockquote`, `label`. Empty, numeric-only, or very short (&lt;3 chars) blocks are skipped. |
| **Inline placeholders** | Inside each leaf block, inline elements (`a`, `span`, `strong`, `em`, `b`, `i`, `small`, `u`, `sup`, `sub`) are replaced with tokens `TAG_OPEN_0`, `TAG_CLOSE_0`, … and the mapping is stored. The **full block text** (with placeholders) is sent as one segment so the translation model sees full-sentence context and can produce correct word order (e.g. for Tamil). After translation, placeholders are restored and the block’s innerHTML is set. |
| **Sentence split** | Only when block text **&gt; 800** characters. Split at `.!?` followed by whitespace and an **uppercase letter** (Latin). **Not** applied for Japanese, Thai, or Arabic script. If the split yields one segment, the block is kept whole. |
| **Large blocks** | If block **&gt; 3000** characters, safe sentence split is applied; if a segment remains &gt; 3000 or unsplittable, the block is **skipped** and a warning is logged. |
| **Rebuild** | **Title:** set text. **Meta description:** set `content` attribute. **Blocks:** replace placeholder tokens in the translated text with the original inline tags, then set each block’s **innerHTML**. Attributes and tag names are preserved via the placeholder mapping. |
| **Output** | Full HTML document (including head and all scripts/styles/meta/link) for both source and translated views. |

---

## Translation quality strategy

| Strategy | Purpose |
|----------|--------|
| **Sentence-level translation** | Long blocks (&gt; 800 chars) are split at sentence boundaries (with uppercase check), translated per sentence, then rejoined. Reduces truncation and preserves meaning. |
| **Short-string glossary** | Strings of **≤2 words and ≤30 characters** are looked up in the glossary first (in-code + optional `data/glossary.json`). Lookup is normalized (trim, collapse spaces, lowercase) so "Log In", "log in" match the same entry. Optional pattern keys with one `*` (e.g. `Delete * files`) match templates. Glossary overrides model for matches; longer phrases are translated by NLLB. |
| **Brand protection** | Protected names are replaced with placeholder tokens before translation and restored after. Prevents brand names from being translated or mangled. |
| **Translation Memory (TM)** | Every translated segment is stored by `source_hash` + `target_lang`. TM stores the post-fluency version, so repeated text is always consistent. Served from TM on cache hit. |
| **Placeholder protection** | `%d`, `%1$s`, `{0}`, `${var}`, `{{var}}` are replaced with tokens before translation and fluency; restored after. Never altered by the model. |
| **Fluency + grammar + tone** | When enabled (`USE_FLUENCY_CORRECTION=true`), translated segments (word count &gt; 2) are rewritten for naturalness, grammar, and UI-appropriate tone via the Python `/fluency-correct` endpoint. TM stores the post-fluency result. |
| **Validation + retry** | Each translation is scored (n-gram overlap, character F-score, length ratio). Segments below **0.85** confidence are retried once; low-confidence indices are logged. |
| **UTF-8 everywhere** | All fetches, file reads/writes, and API responses use UTF-8. Ensures correct rendering for Tamil, Arabic, Japanese, Thai, and other non-Latin scripts. |

---

## Fluency correction (fluency + grammar + tone)

This single post-translation step is responsible for three quality improvements in one backend call:

1. **Fluency** — natural sentence flow and correct word order for the target language.
2. **Grammar** — fix literal translations, unnatural phrasing, punctuation, and language-specific rules (e.g. verb placement in Tamil/Japanese).
3. **User-friendly tone** — concise, polite, product-UI-appropriate phrasing (avoid overly literal or formal document language).

| Property | Value |
|----------|-------|
| When | After NLLB/MyMemory, before validation; TM stores the **fluent** version |
| Skip rule | Segments with **word count ≤ 2** are not sent (short UI strings use glossary/TM) |
| Placeholder safety | Value-style placeholders (`%d`, `%1$s`, `{0}`, `${var}`, `{{var}}`) → `FLUENCY_TOKEN_N`; pipeline tokens (`TAG_OPEN_N`, `BRAND_N`, `__PHn__`) are untouched |
| Backend | Python `POST /fluency-correct` (body: `{ sentences, target_lang }` → response `{ sentences }`) |
| Enable | `USE_FLUENCY_CORRECTION=true` in `server/.env` |
| Fallback | If disabled, timed out (60 s), or the backend errors, original translations are used unchanged |
| Applies to | Webpage HTML translation and `.properties` file translation; all supported languages |

**Python stub:** The current `_fluency_correct_batch` in `python-service/main.py` returns sentences unchanged. To enable real improvements, replace it with an LLM call (e.g. GPT-4, Gemini) that rewrites each sentence while preserving every `FLUENCY_TOKEN_N`. See the docstring in `main.py` for the full contract.

---

## Translation Memory (TM)

- **Keying:** Entries are keyed by **source hash** (SHA-256 of normalized text) and **target language** (NLLB code, e.g. `spa_Latn`). One source segment + one target lang → one cached translation.
- **Persistence:** The TM is stored in **data/translation.db**. sql.js loads this file at first use and writes it back after each batch of new inserts. **TM persists across server restarts.**
- **Reduced API calls:** Segments already in the TM are not sent to NLLB or MyMemory. Repeated content is translated once and reused.
- **Consistency:** The same source text for a given target language always returns the same translation from the TM.
- **Implementation:** Single sql.js instance (in-process SQLite). All queries use parameterized statements. **For horizontal scaling, TM can be migrated to PostgreSQL or another shared store.**

---

## UTF-8 encoding

All I/O in the pipeline uses UTF-8 so languages like Tamil, Arabic, Japanese, and Thai render correctly:

- **Fetch:** `fetchPage` sets `responseType: 'text'` and `responseEncoding: 'utf8'` and adds `Accept-Charset: utf-8`. If a remote server declares a different charset in its `Content-Type` header, Axios does not re-encode; add `iconv-lite` decoding in `fetchPage.js` if you encounter this.
- **File reads:** `fileProcessor.js` uses `buffer.toString('utf8')`. Brand and DB files use `'utf8'` encoding. No change needed.
- **API responses:** `translateUrl.js` sets `Content-Type: application/json; charset=utf-8` via a router-level middleware. `translateFile.js` already sets `Content-Type: text/plain; charset=utf-8` for the `.properties` download.

---

## Brand protection

- **Mechanism:** Before translation, configured brand names (e.g. "Zoho Show", "WorkDrive") are replaced with placeholder tokens (e.g. `BRAND_0`, `BRAND_1`). After translation, tokens are replaced back with the original names.
- **Configuration:** Defaults in code; overrides from **data/brands.json** (array of strings) at server startup. If the file is missing or invalid, built-in defaults are used.

---

## Glossary and UI terminology

The glossary is a **small, focused UI terminology layer** (~25 terms per language), not a full translation dictionary. It enforces consistent terms (Save, Cancel, Log In, Loading, Error, No network, Try again, etc.) while the translation model handles natural phrases.

- **Short-string rule:** Only strings of **≤2 words and ≤30 characters** use the glossary for exact match. This prevents long phrases from being forced through the glossary; the model translates them.
- **Normalized matching:** Input is trimmed, spaces collapsed, and lowercased before lookup. So "Log In", "log in", and "Log in" all match the same entry.
- **Pipeline order:** Glossary runs before TM and NLLB: `Brand protection → Glossary → TM → NLLB → Fluency`.
- **In-code entries:** Core UI terms only (actions, navigation, auth, status, system messages) in `server/services/glossary.js` for Spanish, Portuguese, French, Tamil, Hindi, German, Arabic, Japanese. Product-specific terms are **not** in code.
- **File-based (product terminology):** At startup, `glossary.js` loads **`data/glossary.json`**. Entries are merged on top of the in-code glossary; file entries take precedence. Product teams maintain terminology here without code changes.
  - Schema: `{ "<NLLB_code>": { "<source_phrase>": "<translated_phrase>" } }`
  - Example: `{ "tam_Taml": { "Workspace": "பணிமனை" }, "deu_Latn": { "Dashboard": "Dashboard" } }`
  - **Pattern keys:** Use one `*` for template matching, e.g. `"Delete * files": "Löschen Sie * Dateien"`. Matches "Delete 3 files" or "Delete selected files"; the `*` in the value is replaced by the captured segment.
- **Adding terminology:** Add product or domain terms to `data/glossary.json`. For new languages or one-off overrides, use the same schema. In-code terms are for universal UI only.

---

## Placeholder and variable protection

All placeholder forms are protected before translation (and before fluency correction) so they are never altered by the translation model:

| Format | Example | Protected as |
|--------|---------|--------------|
| Standard printf | `%d`, `%s`, `%n`, `%@` | `FLUENCY_TOKEN_N` (fluency step), `__PHn__` (fileProcessor) |
| Positional printf | `%1$s`, `%2$d` | `FLUENCY_TOKEN_N` |
| MessageFormat / named | `{0}`, `{1}`, `{username}` | `FLUENCY_TOKEN_N` / `__PHn__` |
| Spring template | `${account}`, `${value}` | `FLUENCY_TOKEN_N` / `__PHn__` |
| Double-brace | `{{variable}}` | `FLUENCY_TOKEN_N` / `__PHn__` |

Placeholders are restored to their original form after translation and after fluency correction. `TAG_OPEN_N` / `TAG_CLOSE_N` (HTML inline tags) and `BRAND_N` tokens are left untouched by fluency correction.

---

## Post-processing (UI normalisation)

The optional module **`server/services/postProcessTranslation.js`** provides final normalisation of translated UI strings. It can be integrated after brand restoration in the pipeline to improve fluency, grammar, and style:

- **Spacing** – Normalise newlines, tabs, and spaces; no space before punctuation.
- **Punctuation** – Match source (e.g. add or remove trailing period for labels vs sentences).
- **Formality** – Strip overly formal prefixes per language (e.g. "Bitte" in German, "Por favor" in Spanish) for short phrases.
- **Terminology** – Replace known wrong model output with canonical terms (e.g. Tamil "ஆதாரங்கள்" → "வளங்கள்" for resources; German "extrahieren" → "entpacken", "Passwort" → "Kennwort", "PST und EML" → "PST oder EML").
- **Acronym preservation** – Ensure ZIP, PDF, HTML, EML, PST, etc. stay fully capitalised.
- **Quote normalisation** – Convert typographic quotes (e.g. German „", French «») to ASCII `"` for software strings.

To use it, call `normalizeUITranslationBatch(translations, sources, targetLang)` on the pipeline output before returning results (e.g. in `translatePipeline.js` or in the route after `translatePipeline`).

---

## Validation & quality scoring

- **What is validated:** Each translated segment is scored using n-gram overlap, character n-gram F-score, and length-ratio penalty. A combined **confidence** value (0–1) is computed.
- **Threshold:** Segments with confidence below **0.85** are flagged. Their indices are logged. The threshold is configurable via the `TRANSLATION_CONFIDENCE_THRESHOLD` environment variable (default `0.85`).
- **Retry:** Low-confidence segments are retranslated **once**; the new result is written into the output. No second retry; the latest translation is kept.

---

## Setup

Single `package.json` at the project root; one `npm install` installs both server and client dependencies.

### 1. Install

```bash
npm install
```

### 2. Environment (optional)

Copy `server/.env.example` to `server/.env` and adjust if needed:

- **PORT** – Server port (default: `3002`).
- **USE_PYTHON_SERVICE** – Set to `true` or `1` to use the Python NLLB service instead of MyMemory.
- **PYTHON_SERVICE_URL** – Base URL of the NLLB service (default: `http://127.0.0.1:8000`).
- **USE_FLUENCY_CORRECTION** – Set to `true` or `1` to run fluency + grammar + tone correction after translation (requires Python service with `POST /fluency-correct`). Short segments (≤2 words) are skipped.
- **TRANSLATION_CONFIDENCE_THRESHOLD** – Minimum confidence score (0–1) before a segment is retried (default: `0.85`).

If you do not set these, the app uses **MyMemory** for translation (no extra setup). For better quality, run the Python NLLB service and set `USE_PYTHON_SERVICE=true`. Optionally set `USE_FLUENCY_CORRECTION=true` for naturalness rewrites.

### 3. Run

**Development (server + client):**

```bash
npm run dev
```

- Backend: `http://127.0.0.1:3002` (or your `PORT`)
- Frontend: `http://localhost:5173` (Vite; proxies `/api` to the backend)

**Production-style (single port):**

```bash
npm run build
npm run server
```

Then open `http://localhost:3002` (or your `PORT`). The server serves the built client from `client/dist`.

### Scripts

| Script           | Description                              |
|------------------|------------------------------------------|
| `npm run dev`    | Run server and Vite client together     |
| `npm run server` | Backend only                             |
| `npm run client` | Vite dev server only                     |
| `npm run build`  | Build client to `client/dist`            |
| `npm run preview` | Preview the built client               |
| `npm start`      | Build client then start server            |

---

## Optional: Python NLLB service

For higher-quality translation, run the Python service (NLLB + optional fluency) and point the Node app to it:

1. In the repo, see `python-service/`: **main.py** (FastAPI app) and **translator.py** (NLLB model). Requires Python 3, FastAPI, transformers.
2. Install deps and run the service (e.g. `uvicorn main:app --host 0.0.0.0 --port 8000`).
3. In `server/.env`: `USE_PYTHON_SERVICE=true` and optionally `PYTHON_SERVICE_URL=http://127.0.0.1:8000`. Set `USE_FLUENCY_CORRECTION=true` to enable the `/fluency-correct` endpoint (stub returns input unchanged until you wire an LLM or naturalness model).
4. Restart the Node server.

The Node app calls **POST /translate-batch** for translation; if the call fails, it falls back to MyMemory. When fluency is enabled, it also calls **POST /fluency-correct** after translation (before TM store).

---

## Usage

1. **By URL** – Open “Translate by URL”, enter an http(s) URL, choose target language, click **Translate**. Full-document source and translated HTML appear as raw code; use **Download Translated (.txt)** to save.
2. **By file** – Open “Upload .properties file”, choose a `.properties` file (only values translated; keys, comments, and placeholders preserved). Select target language, click **Translate & Download**. Downloaded as `name-{locale}.properties` (e.g. `messages-ta.properties`).

**Supported target languages:** Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Urdu, Kannada, Malayalam, Punjabi; Spanish, Portuguese (BR), Dutch, German, Indonesian, French, Arabic, Thai, Japanese, Vietnamese.

---

## Security

| Measure | Implementation |
|---------|----------------|
| **SSRF protection** | URL input is validated before fetch. Only `http:` and `https:` are allowed. Invalid URLs and private/internal hosts are rejected with 400. |
| **Host validation** | Localhost, 127.0.0.1, ::1, and private IPv4 ranges are blocked. URL length is capped (e.g. 2048 chars). |
| **Header injection** | Download filenames (Content-Disposition) are sanitized so the header cannot be broken with CRLF or quotes. |
| **File upload** | Multer with memory storage; max 5 MB; `.properties` only (product UI). |
| **SQL injection** | All Translation Memory access uses parameterized queries. No user input is concatenated into SQL. |

---

## Performance

- **Small pages (e.g. &lt; 5k words):** With TM warm, response time is typically **5–15 s** (fetch + extract + pipeline + rebuild). Cold TM or many new segments add NLLB/MyMemory latency.
- **Larger pages:** Processing time grows with segment count; expect **tens of seconds** for very large pages. No streaming; full page is processed before response.
- **TM effect:** Repeated segments are served from TM after the first translation, reducing API calls and improving response time.
- **Python NLLB vs MyMemory:** NLLB is typically faster and higher quality for large batches; MyMemory is remote and rate-limited.

---

## Known limitations

- **Fetch method:** Axios (raw HTTP). JavaScript-heavy SPAs may return incomplete HTML. Server-rendered or static pages work as expected.
- **Translation quality:** MyMemory quality varies. For production-grade quality, the Python NLLB service is recommended.
- **Page size:** Very large pages increase processing time and memory use. Blocks over 3000 chars are split or skipped.
- **NLLB dependency:** High-quality mode requires the separate Python service (and optionally GPU). The app runs without it using MyMemory.
- **Language coverage:** Quality and glossary coverage differ by target language.

---

## Tech stack

- **Backend:** Node.js, Express, Axios (page fetch), Cheerio (HTML parse/rebuild), multer (file upload), sql.js (Translation Memory), CORS, dotenv. Optional: Python NLLB service (FastAPI, transformers).
- **Frontend:** React (Vite), URL input, file upload, language selector, result panels (full-document source and translated HTML as raw code), download button.
- **Extraction/rebuild:** Full document preserved; skip-on-traverse for excluded tags; body leaf blocks only; block-level segments with inline-tag placeholders (TAG_OPEN_N / TAG_CLOSE_N) for correct word order; safe sentence split (&gt; 800 chars, uppercase check, no split for JA/TH/AR); large block protection (&gt; 3000 chars). Title and meta description translated.
- **Pipeline:** Brand protection (`data/brands.json`), glossary (short UI strings ≤2 words / ≤30 chars + optional pattern templates), preprocess, NLLB or MyMemory via `translateWithTm`, optional fluency correction (`fluencyCorrection.js`, Python `/fluency-correct`), validation with low-confidence retry, brand restore, RTL for Arabic. Optional post-processor (`postProcessTranslation.js`) for terminology, formality, acronyms, and quote normalisation.

---

## Project structure

```
webpage-translation/
├── package.json
├── README.md
├── data/
│   ├── brands.json          # Brand names (not translated)
│   ├── glossary.json        # Optional file-based terminology (overrides in-code glossary)
│   └── translation.db       # Translation Memory (created at runtime)
├── docs/
│   └── ANALYSIS_OPTIMIZATION_SECURITY.md
├── server/
│   ├── server.js
│   ├── .env.example
│   ├── database/
│   │   ├── db.js            # sql.js init and save
│   │   └── schema.sql
│   ├── routes/
│   │   ├── translateUrl.js  # POST /api/translate-url
│   │   └── translateFile.js # POST /api/translate-file
│   ├── services/
│   │   ├── fetchPage.js
│   │   ├── extractSentences.js   # Full doc preserved; skip-on-traverse; blocks; placeholders; safe split
│   │   ├── rebuildHtmlFromSentences.js  # Title, meta, blocks (placeholder restore or fallback)
│   │   ├── translatePipeline.js
│   │   ├── translateWithTm.js
│   │   ├── fluencyCorrection.js     # Optional; placeholder protection, skip ≤2 words, Python /fluency-correct
│   │   ├── postProcessTranslation.js # Optional UI normalisation (terminology, formality, acronyms, quotes)
│   │   ├── translationMemory.js      # sql.js; note re PostgreSQL for scaling
│   │   ├── translationClient.js
│   │   ├── httpTranslationFallback.js
│   │   ├── brandProtection.js
│   │   ├── glossary.js
│   │   ├── preprocess.js
│   │   ├── validation.js
│   │   ├── fileProcessor.js
│   │   └── rtlHandler.js
│   └── utils/
│       ├── langMap.js
│       └── urlValidation.js
├── client/
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── App.css
│       ├── index.css
│       ├── utils/
│       │   └── langMap.js
│       └── components/
│           ├── UrlTranslator.jsx
│           ├── FileTranslator.jsx
│           ├── UrlInput.jsx
│           ├── LanguageSelector.jsx
│           ├── ResultViewer.jsx
│           └── DownloadButton.jsx
└── python-service/         # Optional NLLB + fluency server (FastAPI)
    ├── main.py             # FastAPI app: /translate-batch, /fluency-correct
    └── translator.py       # NLLB model loading and inference
```

---

## API

| Endpoint | Description |
|----------|-------------|
| **POST /api/translate-url** | Body: `{ "url": "https://example.com", "targetLang": "es" }`. Returns: `{ sourceHtml, translatedHtml, rtl }`. Full-document HTML (head + body intact). URL must be http(s); private/internal hosts rejected. |
| **POST /api/translate-file** | Form: `file` (`.properties` only), `targetLang`. Returns: translated .properties file (attachment). Only values translated; keys, comments, and placeholders preserved; values already in target script are skipped; download as `name-{locale}.properties`. |
| **GET /health** | Returns `{ "status": "ok" }`. |

---
