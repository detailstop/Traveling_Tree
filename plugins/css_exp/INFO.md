---
id: css_exp
name: CSS 动效组件库
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: css_exp
routes_prefix: /api/plugin/css_exp
summary: 托管 AWA UI 组件库，支持收藏组件代码
icon: 🎨
entries: [css-exp]
tables: [css_exp_favorites]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 同源抓取依赖外部 DOM 结构；外部升级需同步选择器
sensitive_data: []
---
# CSS 动效组件库 信息卡

## 职责
以 iframe 托管 AWA UI（MIT）静态组件库，并可把当前组件详情页的标题/作者/CSS/HTML 收藏到本机 SQLite。

## 入口与路由
- entry：css-exp
- 后端路由：/api/plugin/css_exp

## 数据表
- `css_exp_favorites`（收藏条目：title/category/made_by/css/html/source_url + raw/live）

## 依赖
- provides：无
- consumes：无
- 运行期无第三方 Python 依赖；构建期在项目外执行 `next build` + `next export`，产物置于 `static/app/`

## 注意事项
- 同源抓取依赖外部详情页结构：`pre.language-css` / `pre.language-html`（取 `textContent`）与 `article [class*="content__title"]`；外部升级需同步调整选择器。
- iframe 使用弱沙箱（allow-same-origin 以读取 DOM），不是严格隔离；外部项目须为可信开源代码。收藏预览使用严格沙箱。
- 静态文档走宿主 `/plugins/css_exp/static/app/...`，资源走 `/api/plugin/css_exp/app/...` 兜底（宿主二进制响应带 attachment，顶层文档会被下载）。
- 收藏只写本机 SQLite，不写文件、不使用 localStorage；MIT 许可，展示保留 made_by 署名。
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
