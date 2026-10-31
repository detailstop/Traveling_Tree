---
id: book_reader
name: 俄语书籍阅读
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: reader
routes_prefix: /api/plugin/book_reader
summary: 书籍阅读 · 标注清洗 · 全局词库
entries: [book-reader]
tables: [reader_books, reader_sections, reader_sentences, reader_placeholders, reader_words, reader_phrases, reader_translation_pairs, reader_marks, reader_import_batches, reader_cleaning_tasks, reader_cleaning_records, reader_return_errors, reader_bookmarks]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 俄语书籍阅读 信息卡

## 职责
书籍阅读 · 标注清洗 · 全局词库

## 入口与路由
- entry：book-reader
- 后端路由：/api/plugin/book_reader

## 数据表
- `reader_books`
- `reader_sections`
- `reader_sentences`
- `reader_placeholders`
- `reader_words`
- `reader_phrases`
- `reader_translation_pairs`
- `reader_marks`
- `reader_import_batches`
- `reader_cleaning_tasks`
- `reader_cleaning_records`
- `reader_return_errors`
- `reader_bookmarks`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
