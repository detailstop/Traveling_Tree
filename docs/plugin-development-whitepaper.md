# 旅行之木 · 微内核架构与插件开发白皮书 (v2.0)

> v2.1 补充见文末附录 A–D 索引（2026-10-29）；附录全文已拆到 `docs/appendix/` 下的四个附件文件。附录 A 为 backend-only 插件规范；附录 B 为根路由约定；附录 C 修正二进制响应格式；附录 D 为其他约定。原章节编号不变。

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

## 七、项目状态与交接（2026-10-30）

### 7.1 插件清单
- **22 个插件目录**：19 个有前端卡片的插件（ai、aidebug、bg_library、book_reader、expdata、filejudge、finance、model_usage、netexp、pdf、pixel_art、project_manager、promptgen、rivet、russian、schedule、screeps、sim、urlarch）；3 个 backend-only 插件（webchat、cobuild、tts，`entries: []`，`/api/plugin/<id>/*` 正常分发）。
- **宿主剩余**：`modules/__init__.py`、`modules/settings_store.py`、`ui/web/server.py`、`ui/web/static/app.js`。原 `core/` 与 `db/schema/` 业务 DDL 已清除。

### 7.2 13 个 smoke 基线（结项时点）
| 测试 | 覆盖 | 基线 |
|---|---|---|
| smoke_books.py | 书籍导入/列表 | 11/11 |
| smoke_reader_range.py | 阅读范围/settings/quota | 25/25 |
| smoke_finance.py | 记账、基金、插件路由 | 34/34 |
| smoke_web.py | 宿主 API、cobuild、tts、webchat | 74/75（TTS 502） |
| smoke_pm.py | 项目管理 | 23/23 |
| smoke_model_usage.py | 模型用量与定价 | 49/49 |
| smoke_file_preview.py | 文件预览 | 17/17 |
| smoke_pdf.py | PDF 与二进制响应 | 17/17 |
| smoke_plugin_data_dirs.py | 插件 data_dirs | 13/13 |
| smoke_plugin_decoupling.py | 19 卡片插件改名/重启解耦 | 452/452 |
| smoke_plugin_module_off.py | 模块关闭 503/不建表 | 10/10 |
| smoke_plugins.py | manifest/清单/静态资源/后端 | 181/181 |
| smoke_startup_once.py | 首次启动建表/API | 33/33 |

已知 FAIL：`smoke_web` 的 TTS 502 来自 edge-tts 外部网络不可用，不阻塞其他断言；出现非 TTS 的 FAIL 按回滚规则处理。

### 7.3 剩余 pending
- `tests/smoke_plugin_decoupling.py::Server.start` 的 `stop()` 异常保护：低概率进程竞态边界，三次 452/452 通过，暂不修，留观察。

### 7.4 交接建议
- 新功能：在 `plugins/` 下新建插件，写 `manifest.json` + `backend.py`；有业务表加 `schema.sql`，参照附录 A–D。
- 改现有功能：直接改对应插件目录，不碰宿主。
- 每轮下沉、改 settings 或改 API 后运行全量 13 个 smoke。
- `/api/plugin/<id>/*` 必须有语义子路径，按附录 B 命名。
- 二进制响应用 `__binary__: True` + `body`/`mime`/`filename`/`headers`，不要用旧版 bytes 直传。
- TTS 502 是已知外部网络问题；出现其他 FAIL 先回滚再定位。

### 7.5 数据资产
- 主库 `data/russian_tutor.db`（唯一业务主库；文件名与项目目录名解耦，不改）。
- `data/settings.json`：`download_groups` + `modules.enabled`；插件 settings 在 `data/plugins/<id>/settings.json`。
- 敏感文件：`data/ai_keys.json`、`data/webchat_sessions.json`、`data/plugins/webchat/webchat_profile/`、`data/plugins/finance/fixtures/rt_fin.json`；只按路径处理，不读正文、不进 Git。

## 八、docs 目录与临时文件闭环

- `docs/` 只允许长期存放三类内容：白皮书（本文件）、`多AI共建日志.md`（自动镜像，勿手改）、`appendix/`（白皮书附件）。
- 其他说明性/一次性材料一律视为临时文件，必须走闭环：**提出 → 确定 → 并入主文件 → 删除**。
- 未闭环即违规：下次接手的 AI 应优先处理，或先向用户确认；不得在 `docs/` 长期堆放临时文件。
- 未闭环项登记到 `docs/appendix/file_navigation.json` 的 `pending[]`；处理完成后（内容并入主文件并删除临时文件）移入 `decided[]`，并在记录中写明 resolution。

## 九、白皮书附件（说明性文件）

三份说明性文件作为白皮书附件统一放在 `docs/appendix/`，不并入本白皮书正文：

| 附件 | 性质 | 使用规则 |
|---|---|---|
| `docs/appendix/file_navigation.json` | 文件去留与审查决策主数据源（pending/decided） | 新增决定追加；历史语义保留；不改 schema |
| `docs/appendix/file_navigation.md` | 由 JSON 生成的只读摘要 | 严禁手改；改 JSON 后运行 `python tools/gen_file_navigation_md.py` |
| `docs/appendix/files_manifest.json` | file_preview 导出的工作区文件清单快照 | 只读参考；不是实时索引，文件变动后需重新导出 |

---

## 附录 A：backend-only 插件规范（v2.1）

全文见 [appendix/A-backend-only.md](appendix/A-backend-only.md)：定义、判断标准、manifest 字段，以及与「宿主是白纸」的关系。

## 附录 B：根路由约定（v2.1）

全文见 [appendix/B-root-routing.md](appendix/B-root-routing.md)：`/api/plugin/<id>/*` 不接受空子路径，下沉路由按语义化子路径映射。

## 附录 C：二进制响应格式修正（v2.1）

全文见 [appendix/C-binary-format.md](appendix/C-binary-format.md)：`__binary__: True` + `body`/`mime`/`filename`/`headers` 的实际格式与宿主解析行为。

## 附录 D：其他约定（v2.1）

全文见 [appendix/D-conventions.md](appendix/D-conventions.md)：插件内部 import、`data_dirs`、`shared_features` 与 `db.migrate` 的待确认项。
