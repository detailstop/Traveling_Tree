# PDF 与压缩（pdf）

## 职责
PDF 工具与批量压缩：合并/拆分/压缩、图片转 PDF。

## 入口与路由
- 分类：functional（有卡片，2 entries）
- 入口：entry `pdf` → `feature_pdf.js`；entry `batch` → `feature_batch.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/pdf/*`，子路径见 `backend.py::handle`

## 数据表
- 无业务表

## 依赖
- 可选：pikepdf / Pillow（`manifest.dependencies.python` 已声明；两者缺失时 `handle()` 返回 `missing_dependency`，`batch/scan` 仍可用）
- 二进制响应按 `__binary__` 协议（附录 C）

## 注意事项
- 批量压缩原位改写/替换原文件，先备份。
- 可选依赖缺失会返回 `missing_dependency`。
