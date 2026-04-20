/**
 * Translation Memory: get/set by source_hash + target_lang.
 * Uses sql.js (no db.all); compatible with server/database/db.js.
 *
 * NOTE:
 * Current TM uses in-process sql.js.
 * For horizontal scaling, migrate to PostgreSQL (or another shared store).
 */

import { getDb } from '../database/db.js';

/**
 * Look up cached translations for many hashes and one target language.
 * @param {string[]} hashes - Source text hashes
 * @param {string} targetLang - NLLB language code
 * @returns {Promise<Map<string, string>>} Map of source_hash -> translated_text
 */
export async function getManyByHashAndLang(hashes, targetLang) {
  const map = new Map();
  if (!hashes || hashes.length === 0) return map;

  const { db } = await getDb();
  const placeholders = hashes.map(() => '?').join(',');
  const sql = `SELECT source_hash, translated_text FROM translation_memory WHERE target_lang = ? AND source_hash IN (${placeholders})`;
  const stmt = db.prepare(sql);
  stmt.bind([targetLang, ...hashes]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    map.set(row.source_hash, row.translated_text);
  }
  stmt.free();
  return map;
}

/**
 * Insert or replace multiple translation memory entries. Persists DB to disk.
 * @param {{ sourceText: string, sourceHash: string, targetLang: string, translatedText: string }[]} entries
 */
export async function insertMany(entries) {
  if (!entries || entries.length === 0) return;

  const { db, save } = await getDb();
  const sql = `INSERT OR REPLACE INTO translation_memory (source_text, source_hash, target_lang, translated_text) VALUES (?, ?, ?, ?)`;
  for (const e of entries) {
    db.run(sql, [e.sourceText, e.sourceHash, e.targetLang, e.translatedText]);
  }
  save();
}
