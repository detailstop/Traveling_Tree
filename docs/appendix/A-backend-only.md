# 附录 A：backend-only 插件规范（v2.1 新增，2026-10-29）

> 白皮书 v2.0 附录 A 全文。白皮书正文保留索引；本文件为白皮书附件。

## A.1 定义
backend-only 插件是 `manifest.entries` 为空数组、但声明了 `backend` 的插件。它不渲染前端卡片，但 `/api/plugin/<id>/*` 正常分发。

## A.2 判断标准
满足以下全部条件时，应建 backend-only 插件：
- 不提供独立 UI 卡片；
- 被其他插件或宿主前端调用（提供共享能力）；
- 有独立业务域（不是宿主基础设施）。

反例：纯配置项（如 `download_groups` 的浏览器目录显示名）无业务逻辑、不被其他插件调用、无独立 UI，不应建 backend-only 插件，留在宿主配置即可。

当前 backend-only 插件：`webchat`、`cobuild`、`tts`。

## A.3 manifest 字段
`entries: []`、`backend: "backend.py"`、`db: null`（除非有业务表）、`style: null`、`data_dirs: []`、`shared_features: []`、`provides: ["<能力名>"]`（可选）。

## A.4 与「宿主是白纸」的关系
backend-only 插件不是宿主基础设施，而是「无 UI 的业务能力」。宿主的四件事（启动、扫插件、挂路由、建表）不变。
