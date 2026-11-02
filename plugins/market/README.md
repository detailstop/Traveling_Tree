# 插件市场（market）

## 职责
本地插件市场：双索引（remote 覆盖 + local INFO 组装），展示/搜索/过滤插件；公共库从 Release 下载安装、卸载，维护安装记录；预置不可卸载、本地开发无按钮。

## 入口与路由
- 分类：functional（有卡片；导航型 entry，左侧栏入口）
- 入口：entry `market` → `feature.js`（`nav: true`）
- 后端：`backend.py`；路由前缀 `/api/plugin/market/*`
  - `GET /list`、`GET /index`、`GET /status?id=`
  - `GET /dependencies`（全部插件依赖检测）、`GET /dependencies/<plugin_id>`（单个，缺失 404）
  - `POST /install`（body `id`）、`POST /uninstall`（body `id`、`delete_data`）

## 数据表
- `market_installed`（id/version/source/installed_at/status/raw_json/live_json）
- raw/live：双列；安装/卸载记录写入 raw=live=当前状态 JSON。

## 开发插件
- 市场页顶部「开发插件」→ `/api/plugin/market/scaffold/fields` 取占位符，动态渲染表单（全部短参数 input）。
- 提交 `/api/plugin/market/scaffold/generate`：严格校验全部占位符（缺失/残留 `{{...}}` 拒绝），写盘到 `data/settings.json` 的 `download_dir`（通用下载地址，绝对路径；仅用于插件服务端写盘，浏览器下载仍走浏览器/统一下载句柄），文件名 `scaffold-<id>-<时间戳>.md`，不覆盖。
- 未设置/目录不存在/无权限/模板缺失均返回明确错误；模板缺失只影响本功能，市场列表/安装/卸载照常。

## 依赖
- `market/index.json`（5 预置出厂模板）、`data/plugins/market/remote_index.json` / `local_index.json`（运行态，不进 Git）
- 预置插件：`market`、`cobuild`、`webchat`、`tts`、`pixel_art`
- 分发：**Release 为唯一分发源**；`market/packages/` 已清空（仅留空目录，脚本备用、勿随意运行）；`downloads/` 存安装临时 zip。

## 双索引与三类插件
- `remote_index.json`：拉取覆盖，公共库（finance/promptgen）包字段；`local_index.json`：扫描 `plugins/*/INFO.md` 组装（21 条展示）。
- 展示合并：INFO > remote > local；`downloads/` 存下载 zip，成功后删除、失败保留。
- 预置 5 不可卸载；公共库 2 可从 Release 安装；本地开发 16 无安装/卸载按钮。

## 拉取最新插件
- 运行态：`remote_index.json`（拉取覆盖）+ `local_index.json`（扫描 INFO 组装）；旧单文件已迁移删除，首次请求自动生成。
- 配置：`data/plugins/market/settings.json` 的 `market_source_url`（https raw index）；为空时按钮置灰。
- 手动点击「拉取最新插件」→ POST `/api/plugin/market/refresh-index`：校验 JSON 结构、id/sha256/size/file/download_url、版本单调递增；通过后只原子覆盖 `remote_index.json`；失败不动本地并返回错误码（not_configured/network_error/http_error/invalid_structure/version_regression/insecure_url）。
- 生产只接受 https；测试通过注入本地假源，不依赖外网。

## 校验打包
- 路由：`POST /api/plugin/market/validate-pack/check`（body `path`）、`POST /api/plugin/market/validate-pack/pack`（body `path`、可选 `out_dir`）；Python：`from plugins.market.validate import validate, pack`。
- 结果固定结构：`{ok, path, id, errors[], warnings[], checked_at, tool_version}`；错误阻止打包，警告仅提示。
- 错误码：`path_empty`、`path_not_found`、`path_not_dir`、`manifest_missing`、`manifest_invalid`、`manifest_id_invalid`、`manifest_id_mismatch`、`schema_version_invalid`、`feature_missing`、`backend_missing`、`dependencies_invalid`、`dependencies_subkey_invalid`、`dependency_name_invalid`、`dependency_version_invalid`、`info_missing`、`info_invalid`、`info_field_missing`、`info_id_mismatch`、`source_package_mismatch`、`source_invalid`、`tables_mismatch`、`has_ui_mismatch`、`has_backend_mismatch`、`pack_empty`。
- 警告码：`readme_missing`、`readme_section_missing`、`info_optional_missing`、`known_limits_empty`。
- **打包脱敏提醒**：打包会将 `INFO.md` 原样入包，`sensitive_data` 字段会公开；请确认只写路径类别、不写敏感内容。
- 源目录只读；打包输出 `data/backup/market_build/<id>.zip`，排除 `__pycache__/`、`*.pyc`、`.git/`、`data/`、`*.zip`、`*.tmp`、`.trash/`；不写 `market/packages/`。

## 注意事项
- 安装前强制 SHA256 + zip 路径穿越/符号链接校验；安装=解压到 `plugins/<id>/`，重启生效。
- 卸载=移出 `plugins/<id>/`（保留 `data/plugins/<id>/`）；勾选删除私有数据时先备份到 `data/backup/uninstall_<id>_<ts>/`。
- **正式规则：卸载不 DROP 主库表。** 唯一例外是测试规则：插件 id 以 `test` 开头且表名以 `test_` 前缀时，可勾选删除测试表，删前先整库备份到 `data/backup/uninstall_<id>_<ts>/`；其他插件一律拒绝。
- `market` 自身为预置，不提供卸载；B 阶段远程市场预留 `fetch_package` / `market_source`。
- 开发插件依赖 `docs/appendix/prompts/plugin-dev-prompt.md`（模板唯一源）；`download_dir` 未设置时按钮置灰。
- 依赖检测（round 107/108）：`deps.py` 只读扫描各 `manifest.dependencies`（`python`/`shared`/`plugins`），Python 包用 `importlib.metadata`（拿版本）→ 失败退回 `importlib.util.find_spec`；`shared` 判宿主公共前端脚本 `ui/web/static/features/<name>.js`（与 `shared_features` 同义，规则来源 `app.js::loadToolFeature`），`plugins` 判 `plugins/<id>/manifest.json`；旧子键 `js` 已废弃，validate 报 `dependencies_subkey_invalid`。
- 版本比较依赖 `packaging`：未安装时降级为只判存在性，接口带 `degraded: true` 与提示，前端顶部显示黄色提示条，不抛异常；同一库被多插件以互斥约束声明时标记 `conflict` 并提示“多版本隔离需后续方案”。
- 依赖状态只提示：不隐藏插件、不禁用安装/卸载/启用、不弹强制确认；不写文件/库，不改四源合并与 `index.json`/`remote_index.json`。
