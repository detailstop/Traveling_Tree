# 插件市场数据库设计草案（round 70）

> **状态（round 82 更新）：A 阶段本地市场已落地。** 新建 `plugins/market/`（`backend.py` + `feature.js` + `schema.sql` + `packaging.py`），实际建表为 `market_installed`（id/version/source/installed_at/status/raw_json/live_json）；`market/index.json` 为只读包清单，`market/packages/*.zip` 不进 Git。B 阶段预留 `market_source` 与 `fetch_package` 的 HTTP 分支（当前只读本地包）。本文件其余字段仍为 B 阶段参考，未全部建表。
>
> A 阶段配置：市场源默认 `market/packages/`（`data/plugins/market/settings.json` 的 `market_source`，只读）；B3 独立市场仓库时源码可能公开，需用户确认后再切换。
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
