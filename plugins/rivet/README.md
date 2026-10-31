# 铆钉点（rivet）

## 职责
铆钉点：习惯/打卡记录。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `rivet` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/rivet/*`，子路径见 `backend.py::handle`

## 数据表
- 无业务表（数据在 `data/plugins/rivet/rivet.json`）

## 依赖
- `data_dirs: ["rivet"]`

## 注意事项
- 数据为 JSON 文件，注意备份。
