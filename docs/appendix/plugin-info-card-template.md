# 插件信息卡模板（INFO.md）

> 状态：round 85 起，`plugins/<id>/INFO.md` 为**必需**结构（与 README 五节并存）。
> README = 详细事实源；INFO.md = 面向市场的精简信息卡。关键字段必须一致，由 `tests/smoke_info_cards.py` 校验。

## 1. 文件位置

- 已安装插件：`plugins/<id>/INFO.md`
- 仅市场源插件：`market/sources/<id>/INFO.md`（如 `sim`）

## 2. front matter 字段

### 必需 9 项

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | string | 与目录名/manifest.id 一致 |
| `name` | string | 与 manifest.name 一致 |
| `version` | string | 与 manifest.version 一致 |
| `kind` | string | `functional` / `library`，以 manifest + lib.json 为准 |
| `has_ui` | bool | manifest.entries 非空 |
| `has_backend` | bool | manifest.backend 非空 |
| `db_module_key` | string/null | manifest.db.module_key；无表为 `null` |
| `routes_prefix` | string/null | 有 backend 为 `/api/plugin/<id>`；否则 `null` |
| `summary` | string | 一句话简介，与 manifest.desc 一致 |

### 可选 11 项

`entries`、`tables`、`data_dirs`、`shared_features`、`provides`、`consumes`、`market_package`、`source`、`known_limits`、`sensitive_data`、`icon`。

- `tables` 必须与 `schema.sql` 的 `CREATE TABLE` 表名完全一致；无表省略或 `[]`。
- `sensitive_data` 只写路径类别（如 `[data/ai_keys.json]`），**不写敏感正文**；市场 UI 不展示其内容。
- `source` 三值：`preset`（预置 5，`market_package:false`）/ `market`（公共库，`market_package:true`，id 在 remote_index）/ `local`（本地开发，`market_package:false`）。
- `known_limits` 单行短句；`market_package` 必须与实际包状态一致（有 zip/Release 为 `true`，预置为 `false`）；`source` 与包来源一致；`icon` 为表情/短字符串，缺省 `📦`。

## 3. 格式约定

- front matter 以 `---` 起止；仅扁平 `key: value`，不支持嵌套。
- 布尔 `true`/`false`；空值 `null`；列表 `[a, b]`；字符串不加引号。
- 解析失败报“信息卡格式错误”，不静默跳过；市场按条目级错误展示，不整体失败。

## 4. 正文固定结构

```markdown
# <name> 信息卡

## 职责
<一句话>

## 入口与路由
- entry：...
- 后端路由：...

## 数据表
- `table` / 无业务表

## 依赖
- provides / consumes
- 第三方依赖不在 INFO 重复声明，见 `manifest.dependencies.python`（最终只有 `python` 子键；跨插件用 `provides`/`consumes`，宿主公共脚本用 `shared_features`）；市场页依赖状态由只读接口检测

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本保持一致。
```

## 5. 示例

```yaml
---
id: market
name: 插件市场
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: market
routes_prefix: /api/plugin/market
summary: 本地插件包浏览、安装、卸载与预置状态
icon: 🛍️
entries: [market]
tables: [market_installed]
data_dirs: []
shared_features: []
provides: [market]
consumes: []
market_package: false
source: local
known_limits:
sensitive_data: []
---
```

## 6. 校验与生成

- 校验：`python tests/smoke_info_cards.py`、`python tools/gen_plugin_info_cards.py --check`
- 生成骨架：`python tools/gen_plugin_info_cards.py`（不覆盖已有文件；`--force` 覆盖）
- 校验口径：必需字段齐全、id 与目录一致、`kind/has_ui/has_backend/db_module_key/routes_prefix` 与 manifest 一致、`tables` 与 schema 一致、列表字段与 manifest 一致、`summary` 非空且与 manifest.desc 一致。
