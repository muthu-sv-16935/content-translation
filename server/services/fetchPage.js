/**
 * Fetch page HTML using axios only.
 * Fast and simple; works for server-rendered pages.
 * JS-rendered (SPA) pages may return incomplete content.
 *
 * UTF-8 strategy:
 *  - responseType: 'text' forces Axios to return a string (not a Buffer/parsed object).
 *  - responseEncoding: 'utf8' is the default for text; listed here for explicitness.
 *  - If the remote server declares a different charset in Content-Type (e.g. ISO-8859-1),
 *    Axios does not re-encode; the caller should add iconv-lite decoding if that is needed.
 *    For the vast majority of modern sites (UTF-8 or meta charset) this is not required.
 */

import axios from 'axios';

const FETCH_TIMEOUT_MS = 15000;

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Charset': 'utf-8',
};

/**
 * Fetches raw HTML from a given URL and returns it as a UTF-8 string.
 * @param {string} url - Full webpage URL (caller must validate)
 * @returns {Promise<string>} Raw HTML (UTF-8)
 */
export async function fetchPage(url) {
  const response = await axios.get(url, {
    headers: DEFAULT_HEADERS,
    timeout: FETCH_TIMEOUT_MS,
    maxRedirects: 5,
    responseType: 'text',
    responseEncoding: 'utf8',
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = response.data;
  if (typeof html !== 'string') {
    throw new Error('Invalid response: expected HTML string');
  }

  return html;
}
