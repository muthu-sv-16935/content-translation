-- Translation Memory: store source_hash + target_lang -> translated_text for consistency
CREATE TABLE IF NOT EXISTS translation_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_text TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_translation_memory_lookup
  ON translation_memory(source_hash, target_lang);
