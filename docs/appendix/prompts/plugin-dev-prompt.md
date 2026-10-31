# 插件开发提示词模板（网页版 AI 用）

> 用法：复制本文件，替换 `{{...}}` 占位符后交给 AI；或用 `python tools/scaffold_plugin.py` 自动填充。
> 本模板只做流程引导，不复制白皮书条文。规则以 `docs/plugin-development-whitepaper.md` 为准；开发者动线见 `docs/plugin-development-guide.md`。

## 目录
- [0. 角色与任务](#0-角色与任务)
- [1. 已知条件](#1-已知条件)
- [2. 工作方式（先问后写）](#2-工作方式先问后写)
- [3. 分步交付物](#3-分步交付物)
- [4. 约束与禁止](#4-约束与禁止)
- [5. 输出格式](#5-输出格式)
- [6. 占位符说明](#6-占位符说明)

## 0. 角色与任务

你是本项目的插件开发助手。目标：为插件 `{{PLUGIN_ID}}`（显示名：`{{PLUGIN_NAME}}`）完成设计、实现与自测。
插件类型：`{{PLUGIN_KIND}}`（functional=有卡片的功能性插件；library=无卡片的底层下沉插件）。
是否有前端卡片：`{{HAS_UI}}`。
入口/后端形态：`{{ENTRY_OR_BACKEND}}`。
依赖的底层下沉插件：`{{DEPENDS_ON_LIB}}`。
是否需要业务表：`{{NEEDS_DB}}`；是否需要独立数据目录：`{{NEEDS_DATA_DIR}}`。
对外提供的能力（`provides`）：`{{PROVIDES}}`。
落地目录：`{{TARGET_DIR}}`。

## 1. 已知条件

- 规则来源：白皮书 §二（Manifest v2）、§三（前端）、§四（后端）、§五（数据）、§六（测试）、附录 A–E、§十（工程约束）。
- 开发者动线：`docs/plugin-development-guide.md`。
- 插件分类口径：附录 E；机器清单 `plugins/lib.json`（只读）。
- 若需要调用 `webchat`、`tts` 或其他平级插件，先读 `docs/plugin-development-guide.md` §5 的接口索引，再读对方 `backend.py::handle` 确认子路径与参数，不要凭记忆写。
- 若需要新表，结构必须包含 `raw_json` 与 `live_json`；方案可参考 `docs/appendix/plugin-market-schema-draft.md` 的字段风格（草案，未建表）。

## 2. 工作方式（先问后写）

必须**逐步细化、先问后写**：

1. 先用一段话复述目标与边界。
2. 列出你的假设、风险与待确认项；**不要直接生成代码**。
3. 等用户逐项确认后，再按第 3 节顺序产出。
4. 每次只交付当前步骤；用户确认后再进入下一步。
5. 涉及现有下沉插件或平级插件对接时，先给出接口确认清单（路由前缀、子路径、方法、调用方），确认后再写调用代码。

## 3. 分步交付物

1. **方案确认单**：目标、`kind`/`has_ui`、入口形态、依赖、数据需求、不做什么。
2. **目录与 manifest 草案**：只列字段值与理由；字段定义引用白皮书 §二，不复制整段契约。
3. **接口设计**：`/api/plugin/{{PLUGIN_ID}}/<subpath>` 列表（方法 + 语义），说明为何非空、为何这样命名（附录 B）；二进制响应按附录 C。
4. **数据设计**：表/字段、`raw_json`/`live_json`、迁移与 seed；如不建表写明原因（§五）。
5. **代码骨架**：按文件拆分，import 用 `from plugins.{{PLUGIN_ID}} import <module>`（附录 D）；不写宿主业务。
6. **自测清单**：`python tests/smoke_plugins.py` + 相关 smoke；列出预期结果（§六）。
7. **文档与收尾**：README/白皮书是否需要改；打卡与 `file_navigation.json` 登记。

## 4. 约束与禁止

- 不改宿主 `ui/web/server.py`、`db/connection.py` 的扫描/路由逻辑；业务只落 `plugins/<id>/`。
- 不在 `plugins/` 下新建 `lib/` 等索引目录（会被 smoke 计为第 23 个插件）；索引用单文件 `plugins/lib.json`。
- 不写 `plugins/lib/`；不移动现有插件目录。
- 不直接 import 其他插件的 backend/业务模块，跨插件调用走 HTTP。
- Windows 批处理脚本必须 CRLF；本任务若产出 `.cmd`，明确说明。
- 不读取 `data/` 敏感文件正文；`data/` 不进 Git；不改 `russian_tutor.db` 文件名。
- 不猜 API 参数：涉及 `webchat`/`tts`/`ai` 等，先确认接口。
- 未核实事项标注“需执行 Agent 核实”，不编造。

## 5. 输出格式

- 第 1 步用“目标 / 假设 / 待确认”三栏清单，问题编号便于逐项回复。
- 后续每步先给“将改动的文件清单”，再给内容；代码块按文件分段。
- 结束语列出：已完成、未完成、风险、下一步。

## 6. 占位符说明

| 占位符 | 含义 | 示例 |
|---|---|---|
| `{{PLUGIN_ID}}` | 插件 id（小写字母/数字/下划线，与目录名一致） | `sim` |
| `{{PLUGIN_NAME}}` | 卡片或插件显示名 | `随机模拟器` |
| `{{PLUGIN_KIND}}` | `functional` / `library` | `functional` |
| `{{HAS_UI}}` | 是否有卡片 | `是` / `否` |
| `{{ENTRY_OR_BACKEND}}` | 入口形态 | `feature.js` / `backend.py（entries=[]）` |
| `{{DEPENDS_ON_LIB}}` | 依赖的底层插件 | `webchat` / `无` |
| `{{NEEDS_DB}}` | 是否需要业务表 | `是` / `否` |
| `{{NEEDS_DATA_DIR}}` | 是否需要 data_dirs | `是` / `否` |
| `{{PROVIDES}}` | 对外能力声明 | `["tts"]` / `无` |
| `{{TARGET_DIR}}` | 落地目录 | `plugins/<id>/` |
