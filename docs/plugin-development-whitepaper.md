# 旅行之木 · 微内核架构与插件开发白皮书 (v2.0)

> v2.1 补充见文末附录 A–D（2026-10-29）。附录 A 为 backend-only 插件规范；附录 B 为根路由约定；附录 C 修正二进制响应格式；附录 D 为其他约定。原章节编号不变。

本文档是“旅行之木”项目的最高开发准则，涵盖了微内核架构设计、插件生命周期管理以及数据安全铁律。任何新增功能的开发都必须严格遵守本白皮书。

## 一、 核心理念与架构定位

“旅行之木”采用极端的**微内核（Microkernel）**架构：

1. **宿主（Host）是白纸**：主程序仅负责启动 Web 服务、扫描插件目录、挂载 API 路由、执行 SQL 初始化以及提供静态服务。主程序内**没有任何业务逻辑**（`TOOLS = []`）。
2. **插件（Plugin）是器官**：所有业务功能（学习、记账、阅读等）均是独立插件。插件必须高度自包含，拔掉任何一个插件文件夹，宿主依然能零报错正常运行。
3. **完全脱离浏览器绑架**：用户的业务内容资产 100% 存放在 SQLite 数据库，界面偏好同步落盘至本地 JSON 文件。浏览器仅作为无状态的渲染器与一级缓存。

## 二、 Manifest v2 契约 (插件的身份证)

插件的存在依赖于根目录下的 `manifest.json`，标准结构如下：

```jsonc
{
  "schema_version": 2,
  "id": "your_plugin_id",
  "name": "插件名称",
  "version": "1.0",
  "enabled": true,
  "entries": [
    {
      "id": "entry_id",
      "name": "卡片名称",
      "icon": "🛠️",
      "feature": "feature.js",
      "shelf": "gen"
    }
  ],
  "backend": "backend.py",      // 若无后端填 null
  "db": {                       // 若无业务表填 null
    "module_key": "your_plugin_id",
    "schema": "schema.sql",
    "seed": "seed.py",          // 可选，首次建库执行
    "migrate": "migrate.py"     // 可选，旧表升级执行
  },
  "style": "plugin.css",        // 若无专属样式填 null
  "data_dirs": ["your_plugin_id"], // 宿主自动在 data/plugins/ 下建目录
  "shared_features": []         // 依赖的宿主公共脚本，如 ["webchat"]
}
```

## 三、 前端开发规范 (feature.js)

- **ESM 动态加载**：插件前端必须是 ES Module，导出 `render(container)` 函数。宿主会在用户点击卡片时通过 `import('/plugins/<id>/feature.js')` 动态加载。
- **样式自包含**：所有专属 CSS 必须写在 `plugin.css` 中，禁止污染主程序的 `app.css`。禁止直接写全局 DOM 样式。
- **API 请求前缀**：所有后端请求必须走 `/api/plugin/<id>/*`。
- **UI 防闪烁与偏好存储**：
  - 前端直接使用 `localStorage.setItem` 保存 UI 偏好（如主题、折叠状态）。
  - 主程序底层已通过拦截器（`Storage.prototype`）监听了白名单内的偏好键，会自动触发防抖并异步同步至后端的 `data/user_preferences.json`。
  - 页面启动时优先读取 `localStorage` 保证秒开，随后异步从后端拉取配置进行对齐。
  - **铁律**：前端不得主动调用 `localStorage.removeItem` 删除用户旧数据。

## 四、 后端开发规范 (backend.py)

- **统一入口**：后端必须暴露 `handle(method, subpath, query, body) -> dict` 函数。
- **路由隔离**：宿主会将 `/api/plugin/<id>/*` 的分发权全权交由该函数处理。
- **二进制响应**：若涉及文件下载（如 PDF），需返回特殊字典结构：`{"__binary__": bytes_data, "__status__": 200, "Content-Type": "application/pdf"}`。
- **模块启停**：如果用户在 `data/settings.json` 中关闭了某模块，宿主的 `_GuardedConnection` 会拦截请求并返回 503。前端应做好 503 容错。

## 五、 数据存储与安全原则（防丢失铁律）

- **业务内容必须有 `schema.sql`**：工作流、计划、书签、对话历史等用户核心内容资产，必须通过插件自己的 `schema.sql` 建表并入库。绝对禁止将业务资产长期存放在浏览器 `localStorage`。
- **仅纯 UI 偏好留在浏览器**：只有主题、折叠、图表模式等不承载业务内容的纯 UI 偏好可以放在本地。判断标准：清空浏览器数据只会损失外观，不会损失用户内容。
- **`raw_json` 与 `live_json` 兜底机制**：所有内容表必须包含：

```sql
raw_json  TEXT NOT NULL,      -- 迁移或初始创建时的原文，永不覆盖
live_json TEXT NOT NULL DEFAULT '' -- 当前编辑状态
```

  前端读取优先使用 `live_json`，为空时回退 `raw_json`。迁移脚本必须打印“原始条目数 / 成功入库条目数”并校验一致，以防静默丢失数据。

- **SQL 集中与隔离**：插件的 SQL 必须集中在自己的 `repo.py` 或 `backend.py` 中，严禁跨插件 JOIN，严禁去宿主里找 SQL。表名必须以插件 ID 或功能为前缀。

## 六、 测试与解耦红线

- **双向绑定校验**：新增插件后必须运行 `python tests/smoke_plugins.py`，确保宿主与插件的清单一致。
- **解耦极限测试**：必须通过 `python tests/smoke_plugin_decoupling.py` 的改名/重启测试。如果你的插件消失或损坏，绝不允许导致宿主启动崩溃（日志无 Error/Traceback）。


---

## 附录 A：backend-only 插件规范（v2.1 新增，2026-10-29）

### A.1 定义
backend-only 插件是 `manifest.entries` 为空数组、但声明了 `backend` 的插件。它不渲染前端卡片，但 `/api/plugin/<id>/*` 正常分发。

### A.2 判断标准
满足以下全部条件时，应建 backend-only 插件：
- 不提供独立 UI 卡片；
- 被其他插件或宿主前端调用（提供共享能力）；
- 有独立业务域（不是宿主基础设施）。

反例：纯配置项（如 `download_groups` 的浏览器目录显示名）无业务逻辑、不被其他插件调用、无独立 UI，不应建 backend-only 插件，留在宿主配置即可。

当前 backend-only 插件：`webchat`、`cobuild`、`tts`。

### A.3 manifest 字段
`entries: []`、`backend: "backend.py"`、`db: null`（除非有业务表）、`style: null`、`data_dirs: []`、`shared_features: []`、`provides: ["<能力名>"]`（可选）。

### A.4 与「宿主是白纸」的关系
backend-only 插件不是宿主基础设施，而是「无 UI 的业务能力」。宿主的四件事（启动、扫插件、挂路由、建表）不变。

## 附录 B：根路由约定（v2.1 新增，2026-10-29）

`/api/plugin/<id>/*` 的分发不接受空子路径。原宿主的根路由在下沉时，映射到语义化 `<subpath>`：

- `GET /api/cobuild` → `GET /api/plugin/cobuild/data`
- `POST /api/tts` → `POST /api/plugin/tts/speak`
- 同类：`/state`（状态）、`/data`（数据列表）、`/speak`（合成）、`/clear-cache`（清理）

选择规则：优先语义化命名（`/data`、`/speak`），不用通用 `/root`；只有一个 POST 动作用动词；返回资源集合用名词。

前端调用 URL 必须同步修改。

## 附录 C：二进制响应格式修正（v2.1，2026-10-29）

v2.0 正文写的 `{"__binary__": bytes_data, "__status__": 200, "Content-Type": "..."}` 是简化描述，宿主实际格式为：

```python
{
    "__binary__": True,
    "body": bytes,              # 必须 bytes/bytearray
    "mime": "application/pdf",  # 可选，默认 application/octet-stream
    "filename": "download.bin", # 可选，默认 download.bin
    "headers": {"Cache-Control": "..."},  # 可选
}
```

宿主解析：`if result.get("__binary__") is True:` → 读 `body`/`mime`/`filename`/`headers`；`body` 非 bytes 返回 500 `plugin_error`。按 v2.0 格式写的插件会 500。

受影响插件：`plugins/tts/backend.py`（已是宿主格式）、`plugins/pdf/backend.py`（round 57 核实）。

## 附录 D：其他约定（v2.1，2026-10-29）

- **插件内部 import**：`backend.py` 用 `from plugins.<id> import <module>`，不能用 `from . import`（宿主按文件路径加载 backend，`__name__` 非包名）。
- **`data_dirs` 语义**：宿主自动建 `data/plugins/<id>/`，插件可直接读写；声明在 `manifest.data_dirs`。
- **`shared_features` 注入时机**：待确认（v2.0 未明确）。
- **`db.migrate` 触发条件与失败回滚**：待确认（v2.0 未明确）。
