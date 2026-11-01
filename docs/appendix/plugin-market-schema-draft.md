# 插件市场数据库设计草案（round 70）

> **状态（round 82 更新）：A 阶段本地市场已落地。** 新建 `plugins/market/`（`backend.py` + `feature.js` + `schema.sql` + `packaging.py`），实际建表为 `market_installed`（id/version/source/installed_at/status/raw_json/live_json）；`market/index.json` 为只读包清单，`market/packages/` 为可选发版产物（不进 Git）。B 阶段预留 `market_source` 与 `fetch_package` 的 HTTP 分支（当前只读本地包）。本文件其余字段仍为 B 阶段参考，未全部建表。
>
> 配置：市场源 `data/plugins/market/settings.json` 的 `market_source_url`（https raw）；分销以 Release 为唯一源，`market/packages/` 为空目录。B3 已决定接受源码公开。
>
> 原说明：后续实现落到 `plugins/market/schema.sql`（新建插件 `plugins/market/`）；届时每张内容表必须含 `raw_json TEXT NOT NULL` 与 `live_json TEXT NOT NULL DEFAULT ''`（白皮书 §五）。

## 1. 目标与数据来源

- 本地优先：以本机 `plugins/*/manifest.json` 与 `plugins/lib.json` 为事实来源，生成市场索引快照。
- 远端可选：预留 `source`（`local` / `remote`）、`source_url`、`fetched_at`；本轮不实现同步、不拉取远端。
- 市场表只做快照/索引，不回写插件目录，不参与宿主分发。

## 2. 表结构草案（字段级）

### 2.1 `market_plugins`

| 字段 | 类型建议 | 来源 | 说明 |
|---|---|---|---|
| `id` | TEXT 主键 | manifest.id | 与目录名一致 |
| `name` | TEXT | manifest.name | 显示名 |
| `version` | TEXT | manifest.version | |
| `kind` | TEXT | `plugins/lib.json` | `functional` / `library` |
| `has_ui` | INTEGER/BOOL | `plugins/lib.json` | 是否有卡片 |
| `called_by` | TEXT(JSON) | `plugins/lib.json` | 调用方数组快照 |
| `provides` | TEXT(JSON) | manifest.provides | 能力声明 |
| `depends_on` | TEXT(JSON) | manifest.consumes / lib.json | 依赖声明 |
| `compat` | TEXT | 市场自维护 | 兼容范围（如宿主/白皮书版本） |
| `status` | TEXT | 市场自维护 | `active` / `deprecated` / `broken` |
| `source` | TEXT | 市场自维护 | `local` / `remote` |
| `source_url` | TEXT | 市场自维护 | 远端来源；本地为空 |
| `fetched_at` | TEXT | 市场自维护 | 快照时间（ISO 8601） |
| `manifest_hash` | TEXT | 市场自维护 | manifest 内容哈希 |
| `notes` | TEXT | 市场自维护 | 备注 |
| `raw_json` | TEXT NOT NULL | — | 原始快照 |
| `live_json` | TEXT NOT NULL DEFAULT '' | — | 当前编辑态 |

### 2.2 `market_versions`

| 字段 | 类型建议 | 来源 | 说明 |
|---|---|---|---|
| `plugin_id` | TEXT | manifest.id | 联合主键之一 |
| `version` | TEXT | manifest.version | 联合主键之一 |
| `manifest_hash` | TEXT | 市场自维护 | 版本指纹 |
| `changelog` | TEXT | 市场自维护 | 变更说明 |
| `raw_json` | TEXT NOT NULL | — | |
| `live_json` | TEXT NOT NULL DEFAULT '' | — | |

### 2.3 `market_interfaces`

| 字段 | 类型建议 | 来源 | 说明 |
|---|---|---|---|
| `plugin_id` | TEXT | manifest.id | |
| `route_prefix` | TEXT | 约定 | 固定 `/api/plugin/<id>/` |
| `subpath` | TEXT | backend `handle` | 语义子路径，非空（附录 B） |
| `method` | TEXT | backend `handle` | GET/POST/… |
| `summary` | TEXT | 市场自维护 | 一句话说明，不抄签名 |
| `raw_json` | TEXT NOT NULL | — | |
| `live_json` | TEXT NOT NULL DEFAULT '' | — | |

### 2.4 `market_deps`

| 字段 | 类型建议 | 来源 | 说明 |
|---|---|---|---|
| `plugin_id` | TEXT | manifest.id | |
| `depends_on` | TEXT | manifest.consumes / lib.json | 被依赖插件 id |
| `kind` | TEXT | 市场自维护 | `library`（底层能力）/ `peer`（平级 HTTP） |
| `raw_json` | TEXT NOT NULL | — | |
| `live_json` | TEXT NOT NULL DEFAULT '' | — | |

### 2.5 `market_categories`

| 字段 | 类型建议 | 来源 | 说明 |
|---|---|---|---|
| `id` | TEXT 主键 | 市场自维护 | 分类 id |
| `name` | TEXT | 市场自维护 | 分类名 |
| `raw_json` | TEXT NOT NULL | — | |
| `live_json` | TEXT NOT NULL DEFAULT '' | — | |

## 3. 字段对齐规则

- `id`、`kind`、`has_ui`、`called_by` 以 `plugins/lib.json` 为唯一真相来源；市场表只存快照，不反向修改清单。
- 新增字段必须注明来源：`manifest`（插件自声明）/ `plugins/lib.json`（分类索引）/ `市场自维护`（版本、状态、来源等）。
- `source=local` 时 `source_url` 为空；`source=remote` 时必须有 `source_url` 与 `fetched_at`。
- 接口子路径必须非空；二进制接口仍按白皮书附录 C 的 `__binary__` 协议描述，不在市场表存二进制内容。

## 4. 待定项

- 存储位置：`data/plugins/market/`（JSON/附属文件）还是主库 `market_*` 表；需评估同步频率与内容体积。
- 是否直接复用 `plugins/lib.json` 作为“本地市场清单”，只在需要版本/来源时引入市场表。
- 远端同步协议（拉取方式、鉴权、签名/哈希校验、离线回退）。
- 分类体系与现有插件卡片的 `shelf` 字段如何对齐。
- 是否需要“安装/卸载”动作；若需要，必须先解决插件目录写入与宿主重启的安全边界（本轮不设计）。

## 正式卸载规则（round 84）

- 卸载不 DROP 主库表。
- 唯一例外：插件 id 以 `test` 开头且表名 `test_` 前缀时，可删除测试表；删前整库备份到 `data/backup/uninstall_<id>_<ts>/`。

## B 阶段（round 88）

- 初始化模板：`market/index.json`（5 预置，进 Git）；运行态：`remote_index.json` + `local_index.json`（首次请求生成，旧单文件已删，不进 Git）。
- 拉取：`data/plugins/market/settings.json` 的 `market_source_url`（https raw）；POST `/api/plugin/market/refresh-index`，校验结构/id/sha256/size/file/download_url/版本递增后原子覆盖；失败不动本地。
- 运行态本轮 23 条（5 预置 + 17 非预置 + sim），包级字段留空、`package_ready:false`；待用户上传 GitHub raw。
- 生产只接受 https；`http://`/`file://` 仅测试注入，不进生产路径。

## 打包与 Release 分发（round 90）

- 分发改为 **Release 唯一源**；`market/packages/` 不再保留 zip（空目录，脚本备用）；预置 5 个不打包。
- `tools/build_market_packages.py` 现算 sha256/size/file 并回填 `data/plugins/market/index.json`；`market/index.json` 模板保持 5 条。
- `download_url` 留空；上传 GitHub Release 后回填。为空时安装报“包地址未配置”，不静默。
- 补包不升版（version 保持 1.0）。

## 双文件分离与三类插件（round 91）

- `remote_index.json`：覆盖式，仅拉取写入；公共库 finance/promptgen 的包字段。
- `local_index.json`：组装式，扫描 `plugins/*/INFO.md` 生成（5 预置 + 16 本地开发）。
- 展示合并：INFO > remote > local；旧 `index.json` 迁移后删除。
- 三类：预置 5（preset，不可卸载）、公共库 2（market，Release 安装）、本地开发 16（local，无按钮）。
- 下载目录 `data/plugins/market/downloads/`；成功删除 zip，失败保留。
- `market/packages/` 原 18 个本地 zip 已删除；目录保留空目录，`.gitignore` 规则保留防误提交。

## 校验打包子功能（round 93）

- 路由 `/api/plugin/market/validate-pack/check|pack`；Python `plugins.market.validate.validate/pack`。
- 固定结果 `{ok,path,id,errors,warnings,checked_at,tool_version}`；错误阻止打包，警告仅提示。
- 源目录只读；输出 `data/backup/market_build/<id>.zip`；排除 `__pycache__/`、`data/` 等；不写 `market/packages/`。
- 错误码见 `plugins/market/README.md`「校验打包」节。
