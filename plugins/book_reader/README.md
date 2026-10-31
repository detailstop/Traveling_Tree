# 俄语书籍阅读（book_reader）

## 职责
俄语书籍阅读：导入、分节、生词/短语、阅读进度与书签。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `book-reader` → `feature.js`（另含 `reader_screen.js`）
- 后端：`backend.py`；路由前缀 `/api/plugin/book_reader/*`，子路径见 `backend.py::handle`

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

- raw/live 状态：`reader_bookmarks` 双列；`reader_placeholders` 仅 `raw_json`；其余缺双列（round 71 blocker，按 G2 待 round 73 处理）

## 依赖
- 直接 import：`plugins.pixel_art.service`（G4 已标注；计划改走 HTTP）
- 无外部库硬依赖

## 注意事项
- 表多，schema 变更必须同步 `migrate.py`。
- 阅读数据为用户内容，勿清空。
