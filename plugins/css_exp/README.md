# CSS 动效组件库（css_exp）

> 托管外部开源项目 **AWA UI / handsome-css3-lib**（MIT，https://github.com/ZiYi0414/handsome-css3-lib）的静态导出产物，并提供「收藏组件代码到本机库」的单点数据出口。插件 id `css_exp`，路由前缀 `/api/plugin/css_exp/*`。

## 职责
以 iframe 浏览 AWA UI 的 6 类 CSS/HTML 动效组件（首页、分类、详情），并把当前详情页的标题、作者、CSS、HTML 收藏到本机 SQLite，供「我的收藏」查看与预览。外部项目只读，不修改其源码、不重新构建。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `css-exp` → `feature.js`（iframe 壳 + 收藏按钮 + 我的收藏列表）；样式 `plugin.css`
- 后端：`backend.py`；路由前缀 `/api/plugin/css_exp/*`
  - `GET /app/<path>`：静态产物兜底（`plugins/css_exp/static/app/<path>`，`__binary__` 返回；`index.html` 作目录默认文件；404 = `FILE_NOT_FOUND`）
  - `GET /favorites`：收藏列表（`created_at` 倒序）
  - `POST /favorites`：收藏一条（body：`title`、`category`、`made_by`、`css`、`html`、`source_url`；缺字段 400 `INVALID_REQUEST`；同 `source_url`+`title` 已存在 → 409 `FAVORITE_DUPLICATE`）
  - `DELETE /favorites/<id>`：删除（不存在 404 `FAVORITE_NOT_FOUND`）
- 页面文档加载路径：`/plugins/css_exp/static/app/index.html`（宿主静态路由），页面内资源仍走 `/api/plugin/css_exp/app/...` 兜底

## 数据表
- `css_exp_favorites`：`id`（`fav_` + 16 hex，后端生成）、`title`、`category`、`made_by`、`css`、`html`、`source_url`、`raw_json`、`live_json`、`created_at`；索引 `idx_css_exp_fav_url(source_url)`。
- raw/live：内容表，收藏时 `raw_json = live_json =` 该条快照 JSON；不建触发器，由 SQL 层显式双写。
- 收藏是用户主动保存的数据，不可重建；不写 `data/plugins/css_exp/`、不写文件、不使用 `localStorage` 存收藏。

## 依赖
- **构建期（项目外）**：Node.js ≥ 18 + npm；在外部项目目录执行 `next build` + `next export`（`assetPrefix=/api/plugin/css_exp/app`，`trailingSlash`），把 `out/` 产物拷入 `plugins/css_exp/static/app/`。本插件不跑构建、不引入 npm 工具链。
- **运行期**：无第三方 Python 依赖（仅标准库 + `db.connection`）。
- 跨插件：`consumes: []`、`provides: []`（不调用其他插件，也不对外提供接口；跨插件读取收藏留待后续）。
- 外部项目：AWA UI（MIT）；展示层保留每条组件的 `made_by` 署名与许可声明。

## 注意事项
- **同源抓取与外部结构耦合**：收藏按钮在父页面读取 iframe 的 `contentDocument`，依赖以下结构（外部升级后需同步调整 `feature.js`）：
  - 详情页 URL：`/api/plugin/css_exp/app/{type}/{slug}/`（或静态路由 `.../{type}/{slug}/index.html`），`type` 取 6 类目录名，`slug` 取文件名；
  - 标题/作者：`article [class*="content__title"]`，文本形如 `made_by @ title`；
  - 代码块：`pre.language-css` 与 `pre.language-html`，必须取 `textContent`（`innerHTML` 含 Prism 高亮 token，不是原始代码）。
- **安全取舍**：iframe 使用弱沙箱 `allow-scripts allow-same-origin allow-forms allow-popups`——同源才能抓取 DOM，因此**不是严格隔离**；外部项目为可信 MIT 开源代码，归并前已审阅。收藏预览使用严格沙箱 `sandbox="allow-scripts"`（仅重建预览，不抓取）。
- **静态服务的两段式**：宿主二进制响应固定带 `Content-Disposition: attachment`（已实测：顶层文档会变成下载、子资源不受影响），因此页面文档改用宿主静态路由 `/plugins/css_exp/static/app/...`，CSS/JS/字体/图片/JSON 走插件兜底 `/app/*`；feature.js 拦截 iframe 内链接与卡片点击，统一改为静态路由整页导航。
- 外部项目为只读；不修改 `_migration/css_exp/`，不向其中写入。收藏只落本机 SQLite（`data/russian_tutor.db`），不进 Git。
- 已知限制：外部项目的 Google Fonts 外链与 4 处外链图片在离线环境下不可用（组件本身仍可预览）；外部项目前端使用 Next 客户端路由，本插件通过点击拦截改为整页导航以规避子路径路由问题。
- 若外部项目升级导致 DOM/URL 变化，收藏按钮会提示「未找到 CSS/HTML 代码块」并拒绝写入空数据。
