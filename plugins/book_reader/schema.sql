-- reader 模块
-- 由 db/schema.sql 按业务域拆分；db/schema/*.sql 为唯一建表源。
-- 表结构不得在此之外重复定义；禁用模块时由 db/connection.py 跳过本文件。

-- 俄语书籍阅读：书籍、自由层级、句子/非法占位、标记与共享词库
CREATE TABLE IF NOT EXISTS reader_books (
  book_id TEXT PRIMARY KEY, name TEXT NOT NULL, order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_sections (
  section_id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES reader_books(book_id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES reader_sections(section_id) ON DELETE CASCADE,
  name TEXT NOT NULL, order_index INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_sentences (
  sentence_id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES reader_books(book_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES reader_sections(section_id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL, sentence_ru TEXT NOT NULL, translation_zh TEXT NOT NULL,
  tokens_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_placeholders (
  placeholder_id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES reader_books(book_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES reader_sections(section_id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL, raw_json TEXT NOT NULL, error TEXT NOT NULL,
  import_index INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_words (
  word_id TEXT PRIMARY KEY, lemma TEXT NOT NULL, pos TEXT NOT NULL DEFAULT '', translation TEXT NOT NULL DEFAULT '',
  basic_usage TEXT NOT NULL DEFAULT '', supplementary_notes TEXT NOT NULL DEFAULT '[]',
  inflections TEXT NOT NULL DEFAULT '[]',
  stress INTEGER, examples TEXT,
  export_selected INTEGER NOT NULL DEFAULT 0,
  memorize_round INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(lemma, pos)
);
CREATE TABLE IF NOT EXISTS reader_phrases (
  phrase_id TEXT PRIMARY KEY, phrase_lemma TEXT NOT NULL, phrase_type TEXT NOT NULL DEFAULT '',
  translation TEXT NOT NULL DEFAULT '', basic_usage TEXT NOT NULL DEFAULT '',
  supplementary_notes TEXT NOT NULL DEFAULT '[]', components TEXT NOT NULL DEFAULT '[]',
  stress INTEGER, examples TEXT,
  export_selected INTEGER NOT NULL DEFAULT 0,
  memorize_round INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(phrase_lemma, phrase_type)
);
CREATE TABLE IF NOT EXISTS reader_translation_pairs (
  id TEXT PRIMARY KEY, ru TEXT NOT NULL, zh TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_marks (
  mark_id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES reader_books(book_id) ON DELETE CASCADE,
  sentence_id TEXT NOT NULL REFERENCES reader_sentences(sentence_id) ON DELETE CASCADE,
  mark_type TEXT NOT NULL CHECK(mark_type IN ('word','phrase')), surface TEXT NOT NULL,
  token_indexes TEXT NOT NULL, word_id TEXT REFERENCES reader_words(word_id) ON DELETE SET NULL,
  phrase_id TEXT REFERENCES reader_phrases(phrase_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'uncleaned', source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_import_batches (
  batch_id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES reader_books(book_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES reader_sections(section_id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reader_cleaning_tasks (
  task_id TEXT PRIMARY KEY, scope TEXT NOT NULL, exported_at TEXT NOT NULL,
  range_start INTEGER, range_end INTEGER, range_total INTEGER
);
CREATE TABLE IF NOT EXISTS reader_cleaning_records (
  record_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES reader_cleaning_tasks(task_id) ON DELETE CASCADE,
  mark_id TEXT NOT NULL, address_json TEXT NOT NULL, item_json TEXT NOT NULL, returned_at TEXT
);
CREATE TABLE IF NOT EXISTS reader_return_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, record_id TEXT, error TEXT NOT NULL,
  payload TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reader_sections_parent ON reader_sections(book_id, parent_id, order_index);
CREATE INDEX IF NOT EXISTS idx_reader_sentences_section ON reader_sentences(section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_reader_marks_status ON reader_marks(status, book_id);


-- 共享视觉设置 visual_settings 由 pixel_art/schema.sql 建表；
-- book_reader 通过 plugins.pixel_art.service 间接读写，不重复声明。

CREATE TABLE IF NOT EXISTS reader_bookmarks (
  book_id        TEXT PRIMARY KEY,
  mark_id        TEXT NOT NULL DEFAULT '',
  sentence_index INTEGER,
  raw_json       TEXT NOT NULL,
  live_json      TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL
);
