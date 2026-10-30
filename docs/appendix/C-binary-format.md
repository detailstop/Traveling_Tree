# 附录 C：二进制响应格式修正（v2.1，2026-10-29）

> 白皮书 v2.0 附录 C 全文。白皮书正文保留索引；本文件为白皮书附件。

v2.0 正文写的 `{"__binary__": bytes_data, "__status__": 200, "Content-Type": "..."}` 是简化描述，宿主实际格式为：

```python
{
    "__binary__": True,
    "body": bytes,              # 必须 bytes/bytearray
    "mime": "application/pdf",  # 可选，默认 application/octet-stream
    "filename": "download.bin", # 可选，默认 download.bin
    "headers": {"Cache-Control": "..."},  # 可选
}
```

宿主解析：`if result.get("__binary__") is True:` → 读 `body`/`mime`/`filename`/`headers`；`body` 非 bytes 返回 500 `plugin_error`。按 v2.0 格式写的插件会 500。

受影响插件：`plugins/tts/backend.py`（已是宿主格式）、`plugins/pdf/backend.py`（round 57 核实）。
