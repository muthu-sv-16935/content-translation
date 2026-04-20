import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'translation.db');

let dbHolder = null;

/**
 * Clear the in-memory DB holder so the next call to getDb() starts with a
 * fresh empty database (useful after manually deleting translation.db).
 */
export function resetDb() {
  dbHolder = null;
}

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

/**
 * Get DB instance and save function. Lazy init (async).
 * @returns {Promise<{ db: import('sql.js').Database, save: () => void }>}
 */
export async function getDb() {
  if (dbHolder) return dbHolder;
  ensureDir();
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
  dbHolder = { db, save };
  return dbHolder;
}
