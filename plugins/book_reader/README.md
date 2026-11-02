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

- raw/live 状态：round 76 已补 11 表 `raw_json`+`live_json`（迁移快照，live=raw，触发器维护写入）；`reader_placeholders` 仅 `raw_json`（豁免 live）；`reader_bookmarks` 已合规
- 触发器说明（round 77）：
  1. 依赖 SQLite JSON1（SQLite ≥3.38 默认内置；本机 3.45 可用），目标环境需具备。
  2. 未来给 `reader_*` 表加列后必须重建触发器；`migrate.py` 会在迁移时按 PRAGMA 列重新生成，新增列需同步 JSON 字段。
  3. raw/live 由 AFTER INSERT/UPDATE 触发器维护，业务 SQL 不显式写入；在 `repo.py`/`book_reader.py` 看不到 raw/live 写入属正常。

## 依赖
- 直接 import：`plugins.pixel_art.service`（G4 已标注；计划改走 HTTP——**计划未落地，不写入 `consumes` 之外的任何声明**）
- 跨插件关系：`consumes: ["pixel_art"]`（round 110 按代码实际调用补全：`visual-settings` GET/PUT 与 `/assets` 三处动态 import）
- 降级：pixel_art 不可用时，`/api/plugin/book_reader/reader/visual-settings`（GET/PUT）与 `/api/plugin/book_reader/reader/assets` 直接报错（后端 500），阅读、书签、标注等其余接口不受影响；无 fallback。
- 无外部库硬依赖

## 注意事项
- 表多，schema 变更必须同步 `migrate.py`。
- 阅读数据为用户内容，勿清空。
