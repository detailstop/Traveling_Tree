# 旅行之木 · 微内核架构与插件开发白皮书 (v2.1 草案)

> 本草案已于 2026-10-29 合并到 v2.0 附录 A–D。本文件保留作历史对照。

> 本文件是 v2.0 的修订草案，尚未生效。v2.0 正文（docs/plugin-development-whitepaper.md）仍是当前最高准则。
> 本草案新增/修正以下内容，待用户审阅后合并到 v2.0 或升级为 v2.1。

## 修订摘要

- 新增：backend-only 插件规范
- 新增：根路由约定
- 修正：二进制响应格式（`__binary__`）

## 一、backend-only 插件规范（新增）

### 1.1 定义

backend-only 插件是 `manifest.entries` 为空数组、但声明了 `backend` 的插件。它不渲染前端卡片，但 `/api/plugin/<id>/*` 正常分发。

### 1.2 判断标准

满足以下全部条件时，应建 backend-only 插件：

- 不提供独立 UI 卡片；
- 被其他插件或宿主前端调用（提供共享能力）；
- 有独立业务域（不是宿主基础设施）。

当前 backend-only 插件：

- `webchat`（Playwright 网页会话，ai/finance/app.js 共用）
- `cobuild`（多 AI 共建打卡，独立业务域）
- `tts`（edge-tts 语音合成，app.js/russian/book_reader 共用）

### 1.3 manifest 字段

- `entries: []`
- `backend: "backend.py"`
- `db: null`（除非有业务表）
- `style: null`
- `data_dirs: []`（除非需要独立数据目录）
- `shared_features: []`
- `provides: ["<能力名>"]`（可选，声明可被其他插件消费的能力）

### 1.4 与「宿主是白纸」的关系

backend-only 插件不是宿主基础设施，而是「无 UI 的业务能力」。宿主的四件事（启动、扫插件、挂路由、建表）不变；backend-only 插件只是省略了前端卡片。

## 二、根路由约定（新增）

### 2.1 问题

`/api/plugin/<id>/*` 的分发不接受空子路径。原宿主的根路由 `GET /api/cobuild`、`POST /api/tts` 在下沉时无法直接映射为 `/api/plugin/cobuild`、`/api/plugin/tts`。

### 2.2 约定

根路由（无子路径的 API）在下沉时，映射到 `<subpath>` 之一：

- `GET /api/cobuild` → `GET /api/plugin/cobuild/data`
- `POST /api/tts` → `POST /api/plugin/tts/speak`
- 同类：`/state`（状态）、`/data`（数据列表）、`/speak`（合成）、`/clear-cache`（清理）

选择规则：

- 优先语义化命名（`/data`、`/speak`），不用通用 `/root`；
- 若原路由只有一个 POST 动作，用动词（`/speak`、`/checkin`）；
- 若原路由返回的是资源集合，用名词（`/data`、`/state`）。

### 2.3 前端影响

前端调用的 URL 必须同步修改。原 `/api/<module>/*` 的根路由调用，改为 `/api/plugin/<id>/<subpath>`。

## 三、二进制响应格式（修正）

### 3.1 v2.0 的描述（过时）

```python
{"__binary__": bytes_data, "__status__": 200, "Content-Type": "application/pdf"}
```

### 3.2 宿主实际格式（v2.1 修正）

```python
{
    "__binary__": True,
    "body": bytes,              # 必须 bytes/bytearray
    "mime": "application/pdf",  # 可选，默认 application/octet-stream
    "filename": "download.bin", # 可选，默认 download.bin
    "headers": {"Cache-Control": "..."},  # 可选
}
```

宿主解析逻辑（`ui/web/server.py`）：

- `if result.get("__binary__") is True:` → 读 `body`、`mime`、`filename`、`headers`
- `body` 必须是 `bytes` 或 `bytearray`，否则 500 `plugin_error`
- 按 v2.0 格式写的插件会 500

### 3.3 受影响的插件

- `plugins/tts/backend.py`（round 51 下沉，格式已是宿主实际格式）
- `plugins/pdf/backend.py`（round 23 下沉，需确认是否用宿主格式）

## 四、其他 v2.0 未覆盖的约定（待补）

以下内容在 v2.0 中没有明确，建议 v2.1 补充或作为附录：

- 插件内部 import 约定（round 37 发现：backend.py 用 `from plugins.<id> import <module>`，不能用 `from . import`）
- `data_dirs` 的语义（宿主自动建 `data/plugins/<id>/`，插件可直接读写）
- `shared_features` 的注入时机（宿主在 `render()` 前还是插件自己 import）
- `db.migrate` 的触发条件与失败回滚

---

## 变更对照（v2.0 → v2.1 草案）

| 章节 | v2.0 | v2.1 草案 |
|---|---|---|
| 二、Manifest v2 契约 | 无 backend-only 说明 | 新增 1.1–1.4 |
| 四、后端开发规范 | 二进制格式为 `bytes` | 修正为 `True + body` |
| 新增 | — | 根路由约定 |
| 新增 | — | 其他待补约定 |
