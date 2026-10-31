# 语音朗读（tts）

## 职责
语音朗读：文本转语音、缓存与系统语音回退。

## 入口与路由
- 分类：library（底层下沉，无卡片）
- 入口：无卡片（`entries: []`）
- 后端：`backend.py`；路由前缀 `/api/plugin/tts/*`，子路径见 `backend.py::handle`；契约 `docs/appendix/interfaces/tts.md`

## 数据表
- 无业务表（mp3 缓存在 `data/voice_cache/`）

## 依赖
- 调用方：`ui/web/static/app.js`（russian 间接）
- 外部：edge-tts 在线合成；失败回退系统语音
- 共享缓存例外（G5）

## 注意事项
- 断网 502 为已知环境问题，不阻塞其他断言。
- `/speak` 返回 `__binary__` 音频；`/clear-cache` 清理缓存。
