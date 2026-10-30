# 附录 B：根路由约定（v2.1 新增，2026-10-29）

> 白皮书 v2.0 附录 B 全文。白皮书正文保留索引；本文件为白皮书附件。

`/api/plugin/<id>/*` 的分发不接受空子路径。原宿主的根路由在下沉时，映射到语义化 `<subpath>`：

- `GET /api/cobuild` → `GET /api/plugin/cobuild/data`
- `POST /api/tts` → `POST /api/plugin/tts/speak`
- 同类：`/state`（状态）、`/data`（数据列表）、`/speak`（合成）、`/clear-cache`（清理）

选择规则：优先语义化命名（`/data`、`/speak`），不用通用 `/root`；只有一个 POST 动作用动词；返回资源集合用名词。

前端调用 URL 必须同步修改。
