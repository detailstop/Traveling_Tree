# 旅行之木 · 项目结项报告（2026-10-29）

## 一、项目定位

微内核 + 全插件化 + 无状态前端。宿主只做启动、扫插件、挂路由、建表、静态服务和配置读写；业务全部在 `plugins/`。插件通过 `manifest.json` 声明入口、后端、数据库和样式，宿主不维护插件路由注册表。

## 二、架构摘要

- **22 个插件目录**：
  - 19 个有前端卡片的插件：ai、aidebug、bg_library、book_reader、expdata、filejudge、finance、model_usage、netexp、pdf、pixel_art、project_manager、promptgen、rivet、russian、schedule、screeps、sim、urlarch
  - 3 个 backend-only 插件：webchat、cobuild、tts（`entries: []`，无卡片，`/api/plugin/<id>/*` 正常分发）
- **宿主剩余**：
  - `modules/__init__.py`（包标记）
  - `modules/settings_store.py`（配置基础设施）
  - `ui/web/server.py`（路由与分发）
  - `ui/web/static/app.js`（前端架子）
- **已删除/迁移**：原 `core/`、`db/schema/` 业务 DDL，以及 `modules/` 下全部业务模块；`modules/` 现在只剩上述两个文件。

## 三、数据资产

- 主库：`data/russian_tutor.db`
- `data/settings.json`：仅剩 `download_groups` + `modules.enabled`
- 插件 settings：
  - `data/plugins/russian/settings.json`：`ru_*` / `new_quota` / `review_quota`
  - `data/plugins/model_usage/settings.json`：`model_pricing`
- 业务 JSON：
  - `data/ai_cobuild.json`
  - `data/ai_keys.json`（敏感，不读取正文）
  - `data/webchat_sessions.json`（敏感，不读取 URL 值）
  - `webchat_profile/`（敏感 Chromium 登录态，未移动）
- 归档：`归档/`（`data/`、`docs/`、`modules/` 三个子目录；含 doubao 数据与模块）

## 四、测试矩阵（13 个 smoke）

| 测试 | 端口/方式 | 覆盖范围 | 当前结果 |
| --- | --- | --- | --- |
| `smoke_books.py` | 8897 | 书籍导入/列表 | 11/11 PASS |
| `smoke_reader_range.py` | 8897 | 阅读范围、settings 分组、quota | 25/25 PASS |
| `smoke_finance.py` | 8897 | 记账、基金、crawl/fund 插件路由 | 34/34 PASS |
| `smoke_web.py` | 8898 | 宿主 API、cobuild、tts、webchat 路径 | 74/75 PASS（TTS 502） |
| `smoke_pm.py` | 8899 | 项目管理 | 23/23 PASS |
| `smoke_model_usage.py` | 8899 | 模型用量与定价 | 49/49 PASS |
| `smoke_file_preview.py` | 直调 | 文件预览 | 17/17 PASS |
| `smoke_pdf.py` | 直调 | PDF 合并/拆分/二进制响应 | 17/17 PASS |
| `smoke_plugin_data_dirs.py` | 直调 | 插件 data_dirs | 13/13 PASS |
| `smoke_plugin_decoupling.py` | 直调 | 19 个卡片插件的改名/重启解耦 | 452/452 PASS |
| `smoke_plugin_module_off.py` | 直调 | 模块关闭 503/不建表 | 10/10 PASS |
| `smoke_plugins.py` | 直调 | manifest/清单/静态资源/后端 | 181/181 PASS |
| `smoke_startup_once.py` | 直调 | 首次启动建表/API | 33/33 PASS |

已知 FAIL：`smoke_web` 的 TTS 502，原因是 edge-tts 外部网络不可用；不阻塞其他断言。

## 五、已完成关键动作（round 31–57 摘要）

- round 31–33：一次性工具清理、归档位置搜索、doubao 数据归档。
- round 34–35：归档回填、`归档/` 从文件预览排除。
- round 36–38：modules 引用调查；model_usage、pixel_art、visual_settings 下沉。
- round 39–41：settings 拆文件；`ru_*`/quota 迁 russian，`model_pricing` 迁 model_usage。
- round 42–44：MODULES 清理；decoupling 的 ConnectionResetError 误报修复；MODULES 收缩。
- round 45–51：crawler、ai_bridge、web_chat、cobuild、tts 下沉；doubao_watch 归档下线。
- round 52–56：smoke_plugins 清单动态化；visual_settings DDL 去重；端口 TOCTOU 重试；download_groups 结案留宿主；白皮书 v2.1 草案。
- round 57：PDF `__binary__` 核实；`PLUGINS_WITH_BACKEND` 动态化；v2.1 以附录 A–D 合并；结项。

## 六、剩余 pending

- `tests/smoke_plugin_decoupling.py::Server.start` 的 `stop()` 异常保护：低概率竞态边界，3 次 452/452 通过，本轮不修，留观察。
- 其余历史 pending 均已 resolved；`download_groups` 已按用户裁决留在宿主，不建 downloads 插件。

## 七、交接建议（给接手 AI）

- 新功能：在 `plugins/` 下新建插件，写 `manifest.json` + `backend.py`，有业务表时加 `schema.sql`。参照白皮书附录 A（backend-only）、附录 B（根路由）、附录 C（二进制格式）。
- 改现有功能：直接改对应插件目录，不碰宿主。
- 每轮下沉、改 settings 或改 API 后跑全量 13 个 smoke。
- 根路由不能为空：`/api/plugin/<id>/*` 必须有子路径，按附录 B 语义化命名。
- binary 响应必须用 `__binary__: True + body + mime + filename + headers`，不要按旧版白皮书的 bytes 直传。
- TTS 502 是已知外部网络问题，不阻塞；若新增非 TTS 502 的 FAIL，按回滚规则处理。
