# 文件判官（filejudge）

## 职责
文件判官：扫描、预览、保留标记与删除。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `filejudge` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/filejudge/*`，子路径见 `backend.py::handle`

## 数据表
- 无业务表（保留标记在 `data/plugins/filejudge/keep.json`）

## 依赖
- `data_dirs: ["filejudge"]`
- 可选：Pillow / PyPDF2 / python-docx（预览）

## 注意事项
- 删除为破坏性操作，使用前必须预览确认。
- 可选依赖缺失时返回 `missing_dependency`。
