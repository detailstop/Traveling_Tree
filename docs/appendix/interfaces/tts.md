# 接口契约：tts（`/api/plugin/tts/*`）

- 插件 id：`tts`（kind=library，无卡片）
- 职责：文本转语音并缓存 mp3；edge-tts 失败回落系统语音。
- 路由前缀：`/api/plugin/tts/`
- 契约来源：`plugins/tts/backend.py::handle`（round 71 通读）；合成细节在 `plugins/tts/tts.py`，行为**需执行 Agent 核实**。

## 子路径

| 方法 | 路径 | 入参 | 返回 | 错误码 |
|---|---|---|---|---|
| GET | `/speak` | query：`text`（必填） | 二进制音频（`audio/mpeg`） | 400 缺 text；500 读取失败；502 合成失败；405/404 |
| POST | `/clear-cache` | 无 | `{ok:true, count:<int>, mb:<number>}` | 405/404 |

- 未匹配子路径：`{ok:false, error:"not_found"}`，HTTP 404；方法不符：`{ok:false, error:"method_not_allowed"}`，HTTP 405。
- 缺 `text`：`{ok:false, error:"缺少 text"}`，HTTP 400。
- 合成失败：`{ok:false, error:"语音合成失败（可能未联网）"}`，HTTP 502。

## 二进制响应

`/speak` 返回宿主二进制协议：

- `__binary__: True`
- `body`: mp3 bytes
- `mime`: `audio/mpeg`
- `headers`: `{"Cache-Control": "public, max-age=31536000"}`
- 未设置 `filename`（默认下载名 `download.bin`，浏览器内联播放通常不需要）。

## 调用方（`plugins/lib.json` 的 `called_by`）

`ui/web/static/app.js`（`speakBtn()` 与设置页清理）；`plugins/russian` 经宿主 `speakBtn()` 间接使用。

## 注意事项

- 无网络时 502 属已知环境问题（`smoke_web` 的 TTS 用例）；不阻塞其他断言。
- 缓存位于 `data/voice_cache/`（不在 `data/plugins/tts/`，见 round 71 审查 G5）。
- `clear-cache` 会删除缓存文件并返回数量/大小。
