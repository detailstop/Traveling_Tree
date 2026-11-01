# 插件市场（market）

## 职责
本地插件市场：读取 `market/index.json`，展示/搜索/过滤插件；安装/卸载本地 zip 包，维护安装记录；预置插件不可卸载。

## 入口与路由
- 分类：functional（有卡片；导航型 entry，左侧栏入口）
- 入口：entry `market` → `feature.js`（`nav: true`）
- 后端：`backend.py`；路由前缀 `/api/plugin/market/*`
  - `GET /list`、`GET /index`、`GET /status?id=`
  - `POST /install`（body `id`）、`POST /uninstall`（body `id`、`delete_data`）

## 数据表
- `market_installed`（id/version/source/installed_at/status/raw_json/live_json）
- raw/live：双列；安装/卸载记录写入 raw=live=当前状态 JSON。

## 开发插件
- 市场页顶部「开发插件」→ `/api/plugin/market/scaffold/fields` 取占位符，动态渲染表单（全部短参数 input）。
- 提交 `/api/plugin/market/scaffold/generate`：严格校验全部占位符（缺失/残留 `{{...}}` 拒绝），写盘到 `data/settings.json` 的 `download_dir`（通用下载地址，绝对路径；仅用于插件服务端写盘，浏览器下载仍走浏览器/统一下载句柄），文件名 `scaffold-<id>-<时间戳>.md`，不覆盖。
- 未设置/目录不存在/无权限/模板缺失均返回明确错误；模板缺失只影响本功能，市场列表/安装/卸载照常。

## 依赖
- `market/index.json`（只读）、`market/packages/*.zip`（A 阶段本地包，不进 Git）
- 预置插件：`market`、`cobuild`、`webchat`、`tts`、`pixel_art`
- 插件源码试点：`market/sources/sim/`（进 Git，zip 由脚本生成）
- 本地包：`market/packages/<id>.zip`（18 个本地包保留待下一轮清理；不进 Git；脚本勿随意运行，发版按需使用；Release 上传后回填 `download_url`）

## 双索引与三类插件
- `remote_index.json`：拉取覆盖，公共库（finance/promptgen）包字段；`local_index.json`：扫描 `plugins/*/INFO.md` 组装（21 条展示）。
- 展示合并：INFO > remote > local；`downloads/` 存下载 zip，成功后删除、失败保留。
- 预置 5 不可卸载；公共库 2 可从 Release 安装；本地开发 16 无安装/卸载按钮。

## 拉取最新插件
- 运行态：`data/plugins/market/index.json`；首次请求若缺失，从 `market/index.json`（5 条预置模板）复制，已有不覆盖。
- 配置：`data/plugins/market/settings.json` 的 `market_source_url`（https raw index）；为空时按钮置灰。
- 手动点击「拉取最新插件」→ POST `/api/plugin/market/refresh-index`：校验 JSON 结构、id/sha256/size/file/download_url、版本单调递增；通过后原子覆盖运行态；失败不动本地并返回错误码（not_configured/network_error/http_error/invalid_structure/version_regression/insecure_url）。
- 生产只接受 https；测试通过注入本地假源，不依赖外网。

## 注意事项
- 安装前强制 SHA256 + zip 路径穿越/符号链接校验；安装=解压到 `plugins/<id>/`，重启生效。
- 卸载=移出 `plugins/<id>/`（保留 `data/plugins/<id>/`）；勾选删除私有数据时先备份到 `data/backup/uninstall_<id>_<ts>/`。
- **正式规则：卸载不 DROP 主库表。** 唯一例外是测试规则：插件 id 以 `test` 开头且表名以 `test_` 前缀时，可勾选删除测试表，删前先整库备份到 `data/backup/uninstall_<id>_<ts>/`；其他插件一律拒绝。
- `market` 自身为预置，不提供卸载；B 阶段远程市场预留 `fetch_package` / `market_source`。
- 开发插件依赖 `docs/appendix/prompts/plugin-dev-prompt.md`（模板唯一源）；`download_dir` 未设置时按钮置灰。
