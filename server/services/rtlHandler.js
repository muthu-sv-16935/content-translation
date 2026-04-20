import * as cheerio from 'cheerio';

// RTL CSS using logical properties. Do NOT globally flip images.
const RTL_CSS = `
[dir="rtl"] {
  direction: rtl;
}
[dir="rtl"] body {
  text-align: right;
}
[dir="rtl"] .text-left {
  text-align: right !important;
}
[dir="rtl"] .ml-20 {
  margin-inline-start: 0 !important;
  margin-inline-end: 20px !important;
}
[dir="rtl"] .pl-20 {
  padding-inline-start: 0 !important;
  padding-inline-end: 20px !important;
}
`;

/**
 * When lang === "ar": add <html dir="rtl" lang="ar"> and inject RTL CSS in <head>.
 * Logic isolated in rtlHandler; no image flipping.
 * @param {string} html - Full page HTML
 * @returns {string} Modified HTML with RTL support
 */
export function applyRtlSupport(html) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $('html').attr('dir', 'rtl').attr('lang', 'ar');

  const existingStyle = $('head style').last();
  if (existingStyle.length) {
    existingStyle.append(RTL_CSS);
  } else {
    $('head').append(`<style id="rtl-override">${RTL_CSS}</style>`);
  }

  return $.html();
}
