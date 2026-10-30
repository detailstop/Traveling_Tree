# 附录 D：其他约定（v2.1，2026-10-29）

> 白皮书 v2.0 附录 D 全文。白皮书正文保留索引；本文件为白皮书附件。

- **插件内部 import**：`backend.py` 用 `from plugins.<id> import <module>`，不能用 `from . import`（宿主按文件路径加载 backend，`__name__` 非包名）。
- **`data_dirs` 语义**：宿主自动建 `data/plugins/<id>/`，插件可直接读写；声明在 `manifest.data_dirs`。
- **`shared_features` 注入时机**：待确认（v2.0 未明确）。
- **`db.migrate` 触发条件与失败回滚**：待确认（v2.0 未明确）。
