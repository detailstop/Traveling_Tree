# 语音朗读（tts）· 底层下沉插件

> 分类：`library`（无前端卡片）。分类清单见 `plugins/lib.json`；分类口径见白皮书附录 E。

## 职责
把文本合成为语音并缓存为 mp3，供前端朗读按钮使用：优先 edge-tts 在线神经语音，失败时回落到系统语音（SAPI/MediaPlayer），保证可发声。它不提供卡片或页面。

## 暴露接口（`/api/plugin/tts/*`）
| 方法 | 子路径 | 说明 |
|---|---|---|
| GET | `/speak?text=...` | 合成/读取缓存并返回音频；`__binary__: True` + `audio/mpeg`，`Cache-Control: public, max-age=31536000` |
| POST | `/clear-cache` | 清理语音缓存，返回 `{ok, count, mb}` |

缺少 `text` 返回 400；合成失败返回 502；读取音频失败返回 500；方法不符返回 405；未匹配子路径返回 404。

## 调用方（called_by）
- `ui/web/static/app.js`：`speakBtn()` 调 `/api/plugin/tts/speak`；设置页调 `/api/plugin/tts/clear-cache`。
- `plugins/russian`：朗读按钮调用宿主 `speakBtn()`，间接使用本插件。

## 依赖
- `edge_tts`（以 `python -m edge_tts` 调用）与网络；离线时失败。
- Windows 系统语音/MediaPlayer（回落路径，`subprocess` 调用）。
- 语音缓存目录：`data/voice_cache/`（`config.DATA_DIR` 下）。

## 注意事项
- 已知环境问题：无网络时 `smoke_web` 的 TTS 用例会 502；不阻塞其他断言。
- 缓存按文本哈希命名，命中直接返回；缓存清理接口会删除缓存文件并回报数量/大小。
- 二进制响应必须用 `__binary__: True` + `body`/`mime`/`headers`（见白皮书附录 C），否则宿主返回 500。
- 只处理传入文本，不读取用户其他数据。

## 不面向用户
没有卡片、没有独立入口，不出现在「所有功能」列表；只作为宿主朗读按钮与其他插件（经宿主函数）的共享能力存在。
