# 文件导航清单（只读摘要）

> 只读摘要，勿手改。本文件由 docs/appendix/file_navigation.json 生成；结构与去留决定以 JSON 为准。

- 生成时间：2026-11-02T20:42:12+03:00
- 轮次：108
- 待办：1 条；已决定：720 条

## 待办

| 路径 | 移动计划 | 指南计划 | 摘要 | 轮次 | 创建时间 |
| --- | --- | --- | --- | --- | --- |
| docs/appendix/file_navigation.json | 不移动文件；清理对象是 decided[] 内 28 条非文件占位 path（round 67–94 的 data/bg_import/::roundNN-none），本轮只登记不改动。 | 建议单独一轮统一清理：逐条删除，或在删除时于当轮 decided 写明依据；不改 schema、不改其他历史条目、不编造替代 path。清理完成后再移入 resolved[] 并写 resolution。 | round 67–94 共 28 条 data/bg_import/::roundNN-none 非文件占位待统一清理（:: 前为空目录、无实际文件；round 95 同类占位已于 round 96 删除）。 | 97 | 2026-11-01T17:23:10+03:00 |

## 已决定去留

| 路径 | 决定 | 原因 | 状态 | 轮次 | 时间 | 备份路径 |
| --- | --- | --- | --- | --- | --- | --- |
| plugins/market/deps.py | dependencies 子键 js 改名 shared，检测对齐 shared_features（round 108） | KINDS 改为 (python, shared, plugins)；删除硬编码判定与 _JS_RE，改为 shared_features_dir()/shared_feature_path()/shared_present()，规则来源注明 ui/web/static/app.js::loadToolFeature（features/<name>.js，APP_ASSET_BASE=/static/）；未知子键（含 js）报 dependencies_subkey_invalid；python/plugins/版本/冲突/降级/六态逻辑未变。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| plugins/market/validate.py | 新增 dependencies_subkey_invalid 错误码（round 108） | ERROR_CODES 增加 dependencies_subkey_invalid；合法子键集合由 deps.KINDS 提供（python/shared/plugins），js 作为未知子键被拒；shared 条目按字符串名称校验、不做版本校验。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| plugins/market/feature.js | 依赖明细类别名同步 shared（round 108） | kindName 与遍历数组改为 shared，显示「宿主公共前端脚本」；其余 badge/明细/冲突/降级行为不变。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| plugins/market/README.md | 五节同步 shared 子键与错误码（round 108） | 依赖检测条目改为 python/shared/plugins，注明 shared 与 shared_features 同义、规则来源 app.js::loadToolFeature、js 已废弃；错误码清单补 dependencies_subkey_invalid。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| plugins/market/INFO.md | 信息卡同步 shared 子键（round 108） | 依赖检测条目改为 python/shared/plugins，注明 shared 与 shared_features 同义、旧 js 废弃。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| docs/plugin-development-whitepaper.md | Manifest v2 契约 dependencies 子键 js→shared（round 108） | 示例与规则段改为 shared，补充「与 shared_features 同义同规则、规则来源 app.js::loadToolFeature、宿主只做名称白名单清洗」，并注明 js 废弃报 dependencies_subkey_invalid。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| docs/plugin-development-guide.md | README 依赖节要求同步 shared（round 108） | §4.1 第 4 条改为 python/shared/plugins，注明 shared 与 shared_features 同义同规则。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| docs/appendix/plugin-info-card-template.md | INFO 依赖说明同步 shared（round 108） | 改为 python/shared/plugins，注明 shared 与 shared_features 同义。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| docs/appendix/prompts/plugin-dev-prompt.md | 脚手架提示词同步 shared（round 108） | §0 依赖声明说明改为 python/shared/plugins，注明 shared 与 shared_features 同义同规则。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| tests/smoke_market.py | 补 dependencies 子键用例（round 108） | 新增 3 条：js 作为未知子键被拒（dependencies_subkey_invalid）、shared 合法通过、shared 非数组被拒；用例在临时插件副本上执行，测后随临时目录删除。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 108（js→shared + 对齐 shared_features） | 追加 10 条 decided 并 round→108；pending 保留既有 1 条；resolved 45 条不动；md 由生成器重生成。核实：4 个样本与全部 23 个 manifest 均无 js 子键（零存量）。验证：validate market/4 样本 ok、js 被拒、shared 通过、smoke 1013/1014（仅 TTS 502）、node --check/py_compile 通过、INFO check PASS、生成器幂等。 | done | 108 | 2026-11-02T20:42:12+03:00 |  |
| plugins/market/deps.py | 新增依赖检测模块（manifest.dependencies 三类子键，只读） | 字段契约为 python/js/plugins 三类子键（python 项可字符串或 {name, version}）：python 用 importlib.metadata 取版本、失败退回 find_spec；js 判 ui/web/static/features/<name>.js；plugins 判 plugins/<id>/manifest.json。版本比较用 packaging（缺失时降级为只判存在性并返回 degraded/hint）；同一库多插件互斥约束用区间交集判定 conflict（与 packaging 无关，stdlib 实现）；输出 ok/missing/version_mismatch/conflict/unknown/undeclared 六态与 summary/conflicts。不写文件、不写库、不安装。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/backend.py | 新增 GET /dependencies 与 GET /dependencies/<plugin_id>（round 107） | 语义子路径、非空；单个插件不存在返回 404 PLUGIN_NOT_FOUND；非 GET 返回 405；不改 list/install/uninstall 与四源合并逻辑。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/validate.py | 校验 manifest.dependencies 结构与版本约束（round 107） | 新增 dependencies_invalid / dependency_name_invalid / dependency_version_invalid 三个错误码；复用 deps.declaration_errors；只校验声明结构，不做存在性判定。非法字段用临时插件副本实测被拒绝。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/feature.js | 市场卡片/详情展示依赖状态（round 107） | 列表加载后调 GET /dependencies 并合并；每卡显示依赖 badge（满足/缺失/版本不满足/冲突/无法判断/未声明），展开卡片显示逐项明细（类别/依赖/声明约束/已装版本/状态/说明）与冲突提示；packaging 缺失时顶部黄色提示条；不禁用安装/卸载、不隐藏插件；状态仅内存，不写 localStorage。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/plugin.css | 依赖 badge / 明细 / 降级提示条样式（round 107） | 新增 .mk-dep-* 六态配色、.mk-deps 明细网格、.mk-dep-warn 冲突提示、.mk-deps-banner 降级横幅；仍限 .mk-* 命名空间。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/README.md | 五节同步依赖接口与检测规则（round 107） | 入口与路由补 GET /dependencies 与 /dependencies/<id>；注意事项补检测方式、packaging 降级、冲突提示、不阻断与只读约束。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/market/INFO.md | 信息卡补依赖检测说明（round 107） | 注意事项新增依赖检测要点（只读、六态、degraded、无自动安装与多版本隔离）；front matter 9 项与 tables/source/market_package 未变。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/pdf/manifest.json | 样本回填 dependencies.python = [pikepdf, Pillow]（round 107） | 按源码实际 import 声明；PyPDF2 未在 pdf 中使用，已从 README 依赖节移除并说明。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/filejudge/manifest.json | 样本回填 dependencies.python = [Pillow, PyPDF2, python-docx]（round 107） | 对应 backend 内惰性 import 的可选预览依赖；缺失时插件自身返回 missing_dependency。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/webchat/manifest.json | 样本回填 dependencies.python = [playwright]（round 107） | playwright 在工作线程内 import；浏览器二进制仍由 data/ 下目录与 settings 覆盖，不写入依赖字段。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/tts/manifest.json | 样本回填 dependencies.python = [edge-tts]（round 107） | edge-tts 由 sys.executable -m edge_tts 调用；无最小版本约束要求，故用字符串形式。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/pdf/README.md | 依赖节与 manifest 对齐（round 107） | 移除未使用的 PyPDF2，注明 pikepdf/Pillow 已声明且缺失时返回 missing_dependency。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/filejudge/README.md | 依赖节与 manifest 对齐（round 107） | 注明可选依赖已声明于 manifest.dependencies.python。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/webchat/README.md | 依赖节与 manifest 对齐（round 107） | 注明 playwright 已声明于 manifest.dependencies.python。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/tts/README.md | 依赖节与 manifest 对齐（round 107） | 注明 edge-tts 已声明于 manifest.dependencies.python。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| docs/plugin-development-whitepaper.md | Manifest v2 契约新增 dependencies 字段（round 107） | §二 标准结构补 dependencies 示例，并新增规则段：三类子键、只声明不安装、检测归市场、packaging 降级、冲突提示、README 与字段一致、INFO 不重复。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| docs/plugin-development-guide.md | README 依赖节要求补 manifest.dependencies（round 107） | §4.1 第 4 条：第三方/跨插件依赖须在 manifest.dependencies 声明，README 文字与声明一致，只声明不安装。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| docs/appendix/plugin-info-card-template.md | INFO 依赖节说明不重复声明（round 107） | 注明第三方/跨插件依赖看 manifest.dependencies，市场页依赖状态由只读接口检测。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| docs/appendix/prompts/plugin-dev-prompt.md | 脚手架提示词要求声明 dependencies（round 107） | §0 与占位符表补：依赖须写入 manifest.dependencies（python/js/plugins），只声明不安装。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 107（dependencies 字段 + 检测 + 前端展示 + 4 样本） | 追加 20 条 decided 并 round→107；pending 保留既有 1 条（round 67–94 的 28 条非文件占位）；resolved 45 条不动；md 由生成器重生成。验证：deps 单测 21/21、API 13/13、浏览器走查 default 8/8 + conflict 2/2、validate 5 个插件 ok、非法声明被拒绝、smoke 1010/1011（仅 TTS 502）。未安装任何依赖、未改宿主、未写 requirements.txt。 | done | 107 | 2026-11-02T20:22:46+03:00 |  |
| plugins/urlarch/feature.js | 卡片只显示名称与图片，网址/可执行路径仅在编辑弹层可见（round 106） | 网址卡移除 .ua-card-sub 副行（原显示 note 或 url）与卡片 title 上的 URL tooltip；软件卡移除 .ua-card-sub（原显示 path）；无标题网址卡改为显示「未命名网址」占位名、不再回落展示网址；卡片名称、图片/首字色块、✎ 编辑入口、点击启动与拖拽绑定均未改；数据未删（state/库中 url、path 原样保留，编辑弹层仍读写）。 | done | 106 | 2026-11-02T14:36:12+03:00 |  |
| plugins/urlarch/plugin.css | 清理卡片副行样式（round 106） | 删除仅服务卡片网址/路径副行的 .ua-card-sub 规则；.ua-card-name / 图片 / 首字色块 / 编辑按钮样式保留（无其他使用处）。 | done | 106 | 2026-11-02T14:36:12+03:00 |  |
| plugins/urlarch/README.md | 五节同步卡片展示口径（round 106） | 「架子 + 卡片」注意事项改为：卡片只显示名称与图片，网址/可执行路径仅在编辑弹层查看/编辑；无名称网址卡显示「未命名网址」占位名不回落展示网址；其余接口/数据表/安全段落未变。 | done | 106 | 2026-11-02T14:36:12+03:00 |  |
| plugins/urlarch/INFO.md | 信息卡同步卡片展示口径（round 106） | 卡片条目补「只显示名称与图片，网址 / 可执行路径仅在编辑弹层可见」；front matter 9 项、source=local、market_package=false、tables/data_dirs 均不变。 | done | 106 | 2026-11-02T14:36:12+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 106（卡片仅名称+图片） | 追加 5 条 decided 并 round→106、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。走查 11/11 PASS（卡片无网址/路径文本、弹层字段完整并可保存、删除二次确认、点击启动/拖拽改组/组折叠/全部收起/视图切换/上栏收起/间隔输入均未回归）。本轮无背景库数据，未改后端/schema/migrate。 | done | 106 | 2026-11-02T14:36:12+03:00 |  |
| plugins/urlarch/schema.sql | urlarch_links / urlarch_shortcuts 各加 image 列（round 105） | 两表新增 image TEXT NOT NULL DEFAULT ''（卡片图片文件名，空串=无图）；未改其他列与索引；旧库由 migrate 补列。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/manifest.json | 声明 data_dirs: [urlarch]（round 105） | 按项目 data_dirs 机制创建 data/plugins/urlarch/，后端在其下建 images/ 子目录存图片（data_dirs 单段命名，不能写 urlarch/images）；manifest 其他字段未改。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/migrate.py | 补 image 列迁移（round 105） | 新增 _ensure_links（PRAGMA 检查后 ALTER urlarch_links ADD image）；_SHORTCUTS_COLUMNS/_DDL/_BUSINESS 同步 image；全部加性语句。强制验证停点 13/13 PASS：真实库副本两次 migrate 幂等、旧 links 18 行/白名单 15 行内容哈希不变、image 全为空串、schema→migrate 启动路径同样幂等；备份 data/backup/russian_tutor_before_images_20261102.db。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/security.py | 图片与网址卡字段校验（round 105） | 新增 valid_image_name/validate_image_name（^img_[0-9a-f]{16}\.(png\|jpg\|jpeg\|webp\|gif)$）、image_extension（扩展名白名单）、validate_image_bytes（PNG/JPEG/GIF/WEBP magic）、image_mime、MAX_IMAGE_BYTES=2MB、validate_link_title/validate_link_url；既有路径/参数校验不变。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/repo.py | 网址卡单条读写 + 白名单 image 支持（round 105） | import_state 写 image 列（非法文件名抛 IMAGE_INVALID）；新增 link_ids/find_link/get_link/patch_link/delete_link（state JSON 为真源，表为镜像；link_id 用既有 _link_id 公式重算）；白名单 SELECT/INSERT/UPDATE 带 image，新增 update_shortcut；删除组时条目 image 保留。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/backend.py | 图片上传/读取 + links PATCH/DELETE + shortcuts PATCH 扩展（round 105） | GET /state 附 link_ids；新增 POST /images（JSON {filename,data(base64)}——宿主只解析 JSON 请求体、未改宿主故未用 multipart，且不落 Base64 入库；扩展名+文件头+≤2MB 三重校验，文件名后端生成，临时文件+os.replace）、GET /images/<filename>（正则校验后 __binary__ 返回，no-store）、PATCH/DELETE /links/<id>、PATCH /shortcuts/<id> 扩为 name/path/image/group_id（忽略 args/hotkey/cmd）、删除条目清理图片文件（幂等）；launch 与 R4 安全边界不变。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/feature.js | 两视图改「架子 + 卡片」+ 编辑弹层 + 图片上传 + 删除二次确认（round 105） | 网址/软件条目统一渲染为 .ua-card（名称 + 图片，无图显示名称首字色块，按名称哈希取色）；卡片右下角 ✎ 打开弹层（网址卡：网址/名称/图片；软件卡：名称/路径/图片，隐藏 args/hotkey），保存走 PATCH；图片经本地选择 → 前端扩展名/2MB 快校验 → 上传接口 → 预览 → 随保存提交；删除按钮两次点击确认（3 秒窗口）；软件卡点击启动与拖拽改组保留（拖后抑制点击）；视图切换/上栏收起/全部收起语义未改，未用 localStorage。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/plugin.css | 卡片与编辑弹层样式（round 105） | 新增 .ua-cards 网格、.ua-card/图片/首字色块/编辑按钮、.ua-modal 弹层与表单样式；旧行式 .ua-sc-row 样式保留（无引用但无害）；仍限 .ua-* 命名空间。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/README.md | 五节同步图片/卡片/接口（round 105） | 入口与路由补 links/<id>、images、images/<filename> 与新 PATCH 入参；数据表节补 image 列语义与 images 目录；注意事项补卡片 UI、上传安全规则（含未用 multipart 的原因）、删除清理、错误码。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/INFO.md | 信息卡同步 data_dirs 与图片规则（round 105） | front matter data_dirs 改为 [urlarch]（与 manifest 一致），tables 仍 5 表，source=local / market_package=false 不变；正文补卡片、图片存储位置与上传限制、删除清理。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 105（图片列 + 上传 + 架子卡片 UI） | 追加 11 条 decided 并 round→105、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。安全用例 6.1–6.8 全 PASS（API 32/32 + 浏览器走查 13/13）。真实库未跑 migrate（需重启宿主），已备份。本轮无背景库数据。 | done | 105 | 2026-11-02T14:29:10+03:00 |  |
| plugins/urlarch/feature.js | 删除「站点统筹·网址归档」卡片 + 启动间隔迁入上栏 + 一键收起改为当前视图全部组（round 104） | 删除网址视图中含标题/计数/间隔的功能卡片（同容器无中栏标题条，标题条与按钮不受影响），移除随之失效的 #ua-count 更新；#ua-interval 迁入上栏 #ua-actions-links（标签「⏱ 启动间隔时间」，保留 id、默认 5、0–30 整数校验与 PUT /state 保存路径，软件模式随操作组隐藏）；中栏按钮改为 toggleAllGroups：对当前视图全部组（网址组 / 软件组含未分组）统一折叠或展开，文字在「▾ 全部收起 / ▸ 全部展开」间切换，视图切换与单组折叠互不影响；状态仍为模块内存（uaCollapsedGroups / uaCollapsedShortcutGroups），未用 localStorage。 | done | 104 | 2026-11-02T13:57:05+03:00 |  |
| plugins/urlarch/plugin.css | 清理孤儿样式并新增上栏内联字段样式（round 104） | 删除仅服务被删卡片的 .ua-global-row(.label/.input)、早已不用的 .ua-group-create、以及旧中栏收起用的 .ua-mid[hidden]；新增 .ua-inline-field（启动间隔时间的标签+输入行）；组折叠、列表行、拖拽高亮等样式未改。 | done | 104 | 2026-11-02T13:57:05+03:00 |  |
| plugins/urlarch/README.md | 五节同步：删卡片、间隔位置、一键收起语义（round 104） | 布局段落补「⏱ 启动间隔时间」位于上栏网址操作组；新增 round 104 说明（旧功能卡片与「共 N 条」计数已删除、间隔输入保持 id/校验/API 不变、软件模式不显示）；将中栏「一键收起/展开」改写为「▾ 全部收起 / ▸ 全部展开」，明确只作用于当前视图所有组、两视图折叠互不影响、中栏内容区不再被收起、单组折叠语义不变。 | done | 104 | 2026-11-02T13:57:05+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项同步布局与一键收起语义（round 104） | 布局条目更新为：上栏含「启动间隔时间」、网址视图旧功能卡片已删除、中栏按钮为「全部收起 / 全部展开」且只作用于当前视图所有组、状态仅内存不持久化；front matter 9 项与 source=local / market_package=false / tables 5 表不变。 | done | 104 | 2026-11-02T13:57:05+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 104（删卡片 / 间隔迁入上栏 / 一键收起改语义） | 追加 5 条 decided 并 round→104、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。走查 18/18 PASS（卡片已删、间隔改 7 秒写入 state、软件模式隐藏、网址/软件模式全部收起与展开、两视图独立、单组折叠可用、点击启动/改名/上栏收起回归、无 localStorage 新增、刷新恢复默认）。本轮无背景库数据，未改后端/schema/migrate。 | done | 104 | 2026-11-02T13:57:05+03:00 |  |
| plugins/urlarch/manifest.json | 显示名改为「站点统筹」（round 103，R0） | name 与 entries[0].name 改为「站点统筹」；id=urlarch、目录、路由前缀、表名、version、desc 均不变；schema_version 仍为 2，db.migrate 未动。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| plugins/urlarch/INFO.md | 信息卡 name 同步「站点统筹」并补布局说明（round 103） | front matter name 改为「站点统筹」（9 项必需字段齐全、source=local / market_package=false / tables 5 表不变）；标题与职责同步显示名；注意事项新增布局条目（上栏/中栏状态仅内存、刷新恢复默认、不写 localStorage/库/文件）。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| plugins/urlarch/README.md | README 标题/职责/注意事项同步「站点统筹」与新布局（round 103） | 标题+# 站点统筹（urlarch）并注明显示名变更、id/目录/路由/表名不变；职责改为站点统筹；注意事项新增布局段落（上栏视图切换与按钮组映射、上栏收起、中栏一键收起、三状态仅内存不持久化）；五节结构不变。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| plugins/urlarch/feature.js | 前端布局重构：上栏 + 视图切换 + 上栏/中栏收起（round 103，R1） | 新增 .ua-shell 结构：上栏（品牌「站点统筹」+ 📚网址/🚀软件 切换 + 当前视图操作按钮组 + 收起按钮）、中栏标题条（中栏收起按钮）与中栏内容区（网址视图/软件视图二选一显示）；操作按钮与输入从原卡片搬入上栏且行为/API 不变；视图、上栏收起、中栏收起三项状态存模块内 uaLayout，刷新恢复默认，未使用 localStorage；网址/软件组折叠、拖拽改组、点击启动、改名、调序均未改动。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| plugins/urlarch/plugin.css | 布局样式：上栏/中栏/视图切换（round 103） | 新增 .ua-shell/.ua-topbar(.ua-topbar-collapsed)/.ua-view-switch/.ua-vtab/.ua-actions/.ua-midbar/.ua-mid/.ua-view 等样式，含 [hidden] 强制隐藏与折叠过渡；移除已不再使用的 .ua-sc-form；仍限 .ua-* 命名空间。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| README.md | 根 README 插件显示名同步「站点统筹」（round 103） | 根 README「通用工具」段落中列出该插件显示名，已改为「站点统筹」并注明插件 id `urlarch` 与 id/目录/路由/表名不变；其余目录/清单条目为 id 或目录名，未改动。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 103（改名 + 布局重构） | 追加 7 条 decided 并 round→103、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。走查 21/21 PASS（显示名、默认视图、切换、上栏收起、中栏收起、刷新默认、无 localStorage 写入、网址/软件组折叠与启动/拖拽/改名回归、路由仍 200）。plugins/lib.json 无显示名字段（仅 id/kind/has_ui/called_by/notes），按约定未改。本轮无背景库数据。 | done | 103 | 2026-11-02T10:08:11+03:00 |  |
| plugins/urlarch/repo.py | 组名唯一 + 组/条目 PATCH 的 SQL 层（round 102） | create_shortcut_group 与新增 update_shortcut_group 在 BEGIN IMMEDIATE 内查同名（排除自身），冲突抛 GroupNameConflict → 409；update_shortcut_group 只更新 name/sort_order 并同步 live_json/updated_at（raw 保留建组快照）；set_shortcut_group 只改 group_id 并刷新 live_json/updated_at，不动 path/args/name/hotkey。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/backend.py | 新增两个 PATCH 路由与错误码（round 102） | PATCH /shortcut-groups/<id> 仅接受 name/sort_order（至少一项，否则 INVALID_REQUEST）；PATCH /shortcuts/<id> 只接受 group_id 并忽略 path/args/name/hotkey/cmd，不触发启动；错误码新增 GROUP_NAME_CONFLICT(409)/SORT_ORDER_INVALID(400)/INVALID_REQUEST(400)；POST 建组同名同样 409。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/security.py | 新增严格 sort_order 校验（round 102） | validate_sort_order_strict：仅接受 -10000~10000 的整数（布尔/浮点/字符串/越界 → SORT_ORDER_INVALID 400）；既有 validate_group_name（GROUP_NAME_INVALID）复用于新建与改名；路径/参数校验未变。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/feature.js | 组改名/上下移/条目拖拽改组（round 102） | 组标题栏加 ✏️/↑/↓/🗑️（首组 ↑、末组 ↓ 置灰）；改名走 prompt + PATCH，冲突 toast「组名已存在」并以服务端名恢复；调序按相邻交换并把 sort_order 规范化为 index*10 后逐个 PATCH（刷新保持）；条目行 draggable，拖到组容器（含未分组）后 PATCH 只改 group_id，拖后 400ms 抑制点击避免误启动，失败重新拉取无乐观残留；新增 uaPatch 直连 fetch（宿主 api() 在有 body 时强制 POST）并给 GET 加时间戳绕开缓存。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/plugin.css | 拖拽与禁用按钮样式（round 102） | .ua-sc-row.dragging 半透明、.ua-sg.dragover 高亮描边、.ua-group-ops .mini-btn[disabled] 置灰不可点；仍限 .ua-* 命名空间。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/README.md | 五节同步组名唯一/PATCH/拖拽（round 102） | 入口与路由补两个 PATCH 与建组 409；注意事项新增组名唯一（历史同名保留）、组排序按钮与规范化、条目拖拽只改 group_id 且不触发启动、失败无乐观残留；错误码表补 GROUP_NAME_CONFLICT/SORT_ORDER_INVALID/INVALID_REQUEST。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项补组名唯一与拖拽（round 102） | 新增一条：组名唯一（同名 409）、组用按钮上下移调序（持久化）、条目可拖拽到其他组（只改 group_id、不触发启动）；front matter 9 项与 source=local / market_package=false / tables 5 表不变。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 102（组名去重 + PATCH + 拖拽改组） | 追加 8 条 decided 并 round→102、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。安全用例 4.1–4.5 全 PASS（API 23/23 + 浏览器 10/10）；真实库核实：1 个组（无同名）、2 条白名单均未分组，本轮未改真实库、未跑 migrate。本轮无背景库数据。 | done | 102 | 2026-11-01T19:25:02+03:00 |  |
| plugins/urlarch/schema.sql | 新增 urlarch_shortcut_groups 表 + urlarch_shortcuts.group_id 列（round 101） | 组别表：id/name/sort_order/raw_json/live_json/created_at/updated_at + 索引 idx_urlarch_shortcut_groups_sort(sort_order)；白名单加 group_id TEXT NOT NULL DEFAULT ''（空串=未分组）；未删除既有列（args/hotkey 保留），未改动旧三表。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/migrate.py | 迁移补组别表与 group_id 列（round 101） | 新增 _ensure_shortcut_groups（缺表建表/缺列补列/索引/raw-live 回填）与 _ensure_shortcuts 的 group_id 补列（PRAGMA 检查 + ALTER，旧数据默认空串）；全部加性语句、末尾 commit、失败由 init_db 回滚。验证：真实库副本两次 migrate 幂等，旧三表（1/6/15 行）与 2 条旧白名单内容哈希不变、group_id 均为空串；schema.sql→migrate 启动路径同样通过。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/repo.py | 组别 CRUD + 白名单 group_id 读写（round 101） | list/get/create 组别（id=ug_+16hex、raw/live 双写、显式列名）；白名单 SELECT/INSERT 增加 group_id；delete_shortcut_group 事务内删组并把组内条目 group_id 置空串、按当前列刷新 live_json（raw 保留登记快照），条目不删。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/backend.py | 新增 shortcut-groups 路由与 group_id 校验（round 101） | GET/POST /shortcut-groups、DELETE /shortcut-groups/<id>；POST /shortcuts 接受可选 group_id 并校验组存在（GROUP_NOT_FOUND 404），未传 args 时默认 '[]'；错误码新增 GROUP_NOT_FOUND/GROUP_NAME_INVALID；launch 与安全边界不变。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/security.py | 新增组别名/排序/组 id 校验（round 101） | validate_group_name（1–64 字符、拒绝控制字符 → GROUP_NAME_INVALID）、validate_sort_order（0–9999，非法按 0）、valid_group_id（ug_+16hex）；路径/参数/名称校验不变。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/feature.js | 软件入口改为按组列表 + 组别折叠，移除参数输入（round 101） | 「🚀 软件快捷入口」按组渲染（未分组虚拟组 + 服务端组别），组标题栏点击/▾ 切换折叠，状态存模块内 Set（刷新恢复默认展开）；条目改为列表行（名称 + 完整绝对路径），点击行 → launch（只传 id），✕ 删登记；新增表单仅名称/路径/所属组，删除「参数 JSON 数组」输入框；新增新建组入口，删组提示「组内软件移到未分组」；未改网址组折叠逻辑、未用 localStorage。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/plugin.css | 软件入口列表样式（round 101） | 删除卡片网格样式（.ua-sc-grid/.ua-sc-card/.ua-sc-icon 等），新增 .ua-sg-list/.ua-sc-row 列表行样式（hover/focus-visible），复用 .ua-group/.ua-group-head/.ua-caret 折叠样式；仍限 .ua-sc-*/.ua-sg-* 命名空间。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/README.md | 五节同步组别列表与 group_id（round 101） | 职责/路由/数据表补 shortcut-groups 与 group_id；注意事项补组别折叠（内存态）、删组移到未分组、参数输入已移除与 args 默认 '[]'、错误码新增 GROUP_*；安全边界段落保持。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/INFO.md | tables 增组别表并同步注意事项（round 101） | tables 5 表与 schema 对齐；正文改为按组列表展示、点击行启动、组可折叠、参数输入已移除、删组移到未分组；front matter 9 项与 source=local / market_package=false 不变。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 101（组别表 + group_id + 列表改造） | 追加 10 条 decided 并 round→101、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。安全用例 5.1–5.6 全 PASS（API 26/26 + 浏览器 12/12）。真实库未跑 migrate，已备份 data/backup/russian_tutor_before_shortcut_groups_20261101.db，需重启宿主生效。本轮无背景库数据。 | done | 101 | 2026-11-01T18:38:15+03:00 |  |
| plugins/urlarch/feature.js | R4 方向修正：删除键盘热键层，改为点击式软件快捷入口（round 100） | 移除 keydown 监听、快捷键采集输入框、MutationObserver 注销、组合键解析与 hotkey 提示；新增「🚀 软件快捷入口」卡片网格（首字图标+名称+路径+参数摘要），点击卡片 → POST /launch（只传 id），带删除按钮与添加表单（名称/路径/参数，不再要求 hotkey）；未改既有组别折叠逻辑、未用 localStorage。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/plugin.css | 快捷入口卡片样式替换热键行样式（round 100） | 新增 .ua-sc-grid/.ua-sc-card/.ua-sc-icon 等卡片样式（hover/active/focus-visible 过渡），删除仅在键盘热键层使用的 .ua-sc-kbd/.ua-sc-row/.ua-sc-list；仍限 .ua-sc-* 命名空间。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/backend.py | 移除 hotkey 冲突错误分支，hotkey 改为可选（round 100） | POST /shortcuts 用 security.sanitize_hotkey（可空、仅基础清洗），删除 HOTKEY_CONFLICT 409 分支；launch/CRUD 接口与安全边界不变（仅按 id 启动、路径参数取自库、Popen 列表 + shell=False、忽略请求体 path/args/cmd、异常转 INTERNAL_ERROR）。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/repo.py | 去掉 hotkey 去重与 BEGIN IMMEDIATE，允许同 path 重复登记（round 100） | create_shortcut 删除 ShortcutConflict 与事务内 hotkey 查询，改为单条 INSERT（显式列名 + raw/live 双写、id/时间戳后端生成）；同一 path 允许重复登记（同程序不同参数/入口名），不引入新 schema 约束。另修复编辑过程中误删的 _shortcut_json/list_shortcuts（已核对文件完整）。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/security.py | normalize_hotkey 降级为 sanitize_hotkey（round 100） | hotkey 不再参与逻辑：仅保留长度/类型/控制字符基础清洗（HOTKEY_INVALID 只用于异常输入），删除修饰键/键位格式强校验与规范化；路径、参数、名称、id 校验原样保留。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/README.md | 五节同步「点击快捷入口」语义（round 100） | 职责与注意事项改写：快捷入口为页面内可点击卡片，明确不是键盘热键、不是系统桌面快捷方式（不建 .lnk、不写桌面/开始菜单）；补 hotkey 为历史可选字段、同 path 允许重复、错误码表删除 HOTKEY_CONFLICT；路由与安全边界段落保持。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项改写为快捷入口/白名单/仅本机（round 100） | front matter 9 项与 source=local / market_package=false / tables 4 表不变；正文删除「页面内快捷键」表述，改为点击卡片启动、非系统全局快捷方式、hotkey 历史字段可选。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 100（R4 方向修正） | 追加 8 条 decided 并 round→100、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。安全用例 4.1–4.7 全 PASS（API 31/31 + 浏览器 7/7：卡片渲染、点击启动、path 篡改拒绝、删除后不可启动、Ctrl+Alt+J 不再触发）。本轮无背景库数据、未改 schema/migrate/manifest。 | done | 100 | 2026-11-01T18:09:42+03:00 |  |
| plugins/urlarch/security.py | 新增 R4 安全校验模块（round 99） | 纯函数校验：路径（绝对、存在、拒绝 ..、UNC、控制字符、脚本/快捷方式扩展名黑名单 PATH_EXT_BLOCKED）、参数（JSON 字符串数组、≤20 项/单项≤200/总长≤1000、拒绝 ; && \|\| \| > < 反引号 $( 与换行）、快捷键（修饰键+A–Z/0–9/F1–F12，需含 Ctrl/Alt/Meta 或 F 键，规范化固定顺序）、名称与 id 形态（us_[0-9a-f]{16}）；稳定错误码由 ShortcutError 携带。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/repo.py | 白名单 SQL CRUD（显式列名 + raw/live 双写，round 99） | list/get/create/delete：INSERT 显式列名并同时写 raw_json/live_json（同值快照）；id 由后端 secrets 生成（us_+16hex）、created_at/updated_at 后端生成；create 用 BEGIN IMMEDIATE 内查 hotkey 冲突（ShortcutConflict → HOTKEY_CONFLICT），失败 rollback；DELETE 只删登记行。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/backend.py | 新增白名单 CRUD 与启动接口（round 99） | 语义子路径 state / shortcuts(GET,POST) / shortcuts/<id>(DELETE) / launch(POST)；launch 只接受 id，路径与参数从库读取并在启动前重新校验，subprocess.Popen([path]+args, shell=False, close_fds=True) 不等待；异常统一转 INTERNAL_ERROR，不向宿主抛 Traceback；原有 state 行为不变。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/feature.js | 白名单管理界面 + 页面内快捷键（round 99） | 新增「⌨️ 快捷键白名单」卡片（列表/登记/删除/快捷键采集）；keydown 监听仅在 urlarch 视图存活、页面聚焦、焦点不在输入框时响应，离开视图由 MutationObserver 自动注销；响应不 preventDefault；错误码映射为中文提示；未改既有组别折叠逻辑、未用 localStorage。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/plugin.css | 白名单卡片样式（round 99） | 新增 .ua-sc-* 命名空间（表单、快捷键徽标、路径省略、空态），不污染共享 .gcard/.btn 组件；折叠相关样式未改。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/README.md | 五节同步 R4 路由、安全边界与错误码（round 99） | 入口与路由补 4 个子路径；注意事项补白名单注册制、路径/参数校验、Popen 列表+shell=False、页面内快捷键作用域、hotkey 冲突、稳定错误码、仅本机/勿暴露 0.0.0.0；五节结构与既有内容保持。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项补 R4 安全边界（round 99） | front matter 9 项必需字段与 source=local / market_package=false / tables 4 表不变；正文补白名单注册制、启动接口安全边界、页面内快捷键（非全局热键）、HOTKEY_CONFLICT、仅本机使用。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 99（R4 白名单启动能力） | 追加 8 条 decided 并 round→99、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理）；resolved 45 条不动；file_navigation.md 由生成器重生成。安全用例 5.1–5.8 全 PASS；真实库首次启动由 init_db 建出 urlarch_shortcuts（旧三表 1/6/15 行不变，备份 data/backup/russian_tutor_before_r4_20261101.db）。本轮无背景库数据、未改 schema/migrate。 | done | 99 | 2026-11-01T17:53:43+03:00 |  |
| plugins/urlarch/schema.sql | 新增 urlarch_shortcuts 白名单表（round 98） | CREATE TABLE IF NOT EXISTS：id/name/path/args/hotkey/raw_json/live_json/created_at/updated_at，索引 idx_urlarch_shortcuts_hotkey(hotkey)；属内容表不豁免 live_json（白名单为用户登记数据、不可重建），未加触发器（与本插件其余三表一致，由 SQL 层显式双写）；未改动 urlarch_assets/groups/links 三表与既有索引。 | done | 98 | 2026-11-01T17:39:05+03:00 |  |
| plugins/urlarch/migrate.py | 追加白名单表迁移（round 98） | manifest.json 原已声明 db.migrate（本轮未改 manifest，亦无 tables 字段需同步）；在既有 migrate 追加 _ensure_shortcuts：缺表建表、缺列 ALTER 补列、缺 raw/live 按行回填并建索引，全部加性语句，末尾沿用 conn.commit()、失败由 init_db 统一回滚。验证：真实库副本连跑两次无变更，旧三表行数/内容哈希不变（assets 1 / groups 6 / links 15），缺列形态副本可补列并回填。 | done | 98 | 2026-11-01T17:39:05+03:00 |  |
| plugins/urlarch/INFO.md | tables 增 urlarch_shortcuts 并补白名单说明（round 98） | front matter tables 与 schema 对齐为 4 表；正文数据表与注意事项补“白名单存数据库表、库文件在 data/ 下不进 Git、本轮只建表、启动接口留 R4”；9 项必需字段与 source=local / market_package=false 不变。 | done | 98 | 2026-11-01T17:39:05+03:00 |  |
| plugins/urlarch/README.md | 五节同步白名单表与迁移口径（round 98） | 数据表节补 urlarch_shortcuts 字段/索引/双列/无触发器说明；注意事项补用途（R4 白名单注册制）、存储位置（本机 SQLite，data/ 下不进 Git，不放 plugins/ 与 data/ JSON 配置）、迁移幂等与加性口径；五节结构不变。 | done | 98 | 2026-11-01T17:39:05+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 98（schema + migrate 白名单前置轮） | 追加 5 条 decided 并 round→98、generated_at 更新；pending 保留既有 1 条（round 67–94 的 28 条非文件占位待清理），本轮无新增临时文件；resolved 45 条不动；file_navigation.md 由 tools/gen_file_navigation_md.py 重生成，未手改。本轮无背景库数据（未导入、未构造 mode:update 更新包）。 | done | 98 | 2026-11-01T17:39:05+03:00 |  |
| docs/appendix/file_navigation.json | round 95 五条记录恢复原文、措辞修正在历史条目上回滚（round 97） | 依据 docs/plugin-development-whitepaper.md「docs/appendix/file_navigation.json：新增决定追加；历史语义保留；不改 schema」与 docs/plugin-development-guide.md「导航登记：在 decided[] 追加」：历史条目不得原地改写。已恢复 round 95 的 feature.js / plugin.css / README.md / INFO.md 及本条登记记录原文（原文措辞「组别级单卡」仅作历史语义保留）；round 96 的措辞修正条目保留为历史动作记录。现行措辞以「组别级收起 / 展开」为准：折叠单位是 .ua-group，非卡片。 | done | 97 | 2026-11-01T17:23:10+03:00 |  |
| docs/appendix/file_navigation.json | 登记 28 条非文件占位待清理待办（round 97） | 在 pending[] 新增 1 条汇总待办（path 指向本文件的真实文件路径），记录 round 67–94 的 28 条 data/bg_import/::roundNN-none 非文件占位；本轮不删除历史条目（避免一次改动 28 条历史记录），留单独一轮统一清理。 | done | 97 | 2026-11-01T17:23:10+03:00 |  |
| plugins/urlarch/README.md | 措辞统一为「组别级收起 / 展开」（round 96） | 职责与注意事项删去易被误读为卡片级的措辞：折叠单位是组别（`.ua-group`）；收起后 `.ua-items`/`.ua-blocked` 隐藏、不接收拖拽放置，展开后恢复；五节结构不变。 | done | 96 | 2026-11-01T17:18:19+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项措辞统一为组别级（round 96） | 正文注意事项改为组别级表述；front matter 9 项必需字段、source=local、market_package=false 均不变；gen_plugin_info_cards.py --check 通过。 | done | 96 | 2026-11-01T17:18:19+03:00 |  |
| docs/appendix/file_navigation.json | round 95 记录措辞修正与占位清理（round 96） | 修正 round 95 四条记录措辞为组别级、删除非文件占位 path data/bg_import/::round95-none；本轮无背景库数据（未导入、未构造 mode:update 更新包）；round→96、generated_at 更新；file_navigation.md 由生成器重生成，未手改。 | done | 96 | 2026-11-01T17:18:19+03:00 |  |
| plugins/urlarch/feature.js | 组别级单卡收起 / 展开（round 95） | 点组别标题栏 `.ua-group-head` 空白处或左侧 ▾ 按钮切换该组 `.ua-items`/`.ua-blocked` 显隐；折叠状态存模块内 Set（仅页面会话内存，刷新恢复默认展开），多组互不影响；只切 class 不重绘列表，不写 localStorage、不落库、不改路由与表结构。 | done | 95 | 2026-11-01T17:07:05+03:00 |  |
| plugins/urlarch/plugin.css | 组别折叠样式与 ▾ 旋转过渡（round 95） | 标题栏 `cursor:pointer`+`user-select:none`，`.ua-caret` 加 transform/color 过渡；`.ua-group.collapsed` 时隐藏 `.ua-items`/`.ua-blocked` 并弱化组名；仍只用 .ua-* 命名空间，不污染 .gcard/.btn 等共享组件。 | done | 95 | 2026-11-01T17:07:05+03:00 |  |
| plugins/urlarch/README.md | 五节同步组别折叠能力（round 95） | 职责与注意事项补折叠交互、状态仅存内存、刷新恢复展开、收起时不接收拖拽；五节（职责/入口与路由/数据表/依赖/注意事项）结构不变。 | done | 95 | 2026-11-01T17:07:05+03:00 |  |
| plugins/urlarch/INFO.md | 注意事项补组别折叠说明（round 95） | front matter 9 项必需字段与 source=local / market_package=false 均不变，仅正文注意事项加一行；gen_plugin_info_cards.py --check 与 market validate 均通过。 | done | 95 | 2026-11-01T17:07:05+03:00 |  |
| docs/appendix/file_navigation.json | 登记 round 95 决策（round 95） | 新增 6 条 decided 并更新 round/generated_at；pending 无新增（本轮无 docs 临时文件）；file_navigation.md 由 tools/gen_file_navigation_md.py 重新生成，未手改；docs/多AI共建日志.md 未手改。 | done | 95 | 2026-11-01T17:07:05+03:00 |  |
| plugins/market/validate.py | 导出 ERROR_CODES/WARNING_CODES 常量（round 94） | 在原有校验逻辑不变的前提下集中错误码/警告码清单，供文档一致性测试 import。 | done | 94 | 2026-11-01T16:31:30+03:00 |  |
| tests/smoke_market.py | 文档错误码与常量一致性测试（round 94） | 解析 README 错误码/警告码列表，与 validate.py 常量集合比较；不一致输出差集；故意删 pack_empty 验证失败后恢复；31/31。 | done | 94 | 2026-11-01T16:31:30+03:00 |  |
| plugins/market/README.md | 校验打包补脱敏提醒（round 94） | INFO.md 原样入包，sensitive_data 字段会公开；只写路径类别、不写敏感内容。 | done | 94 | 2026-11-01T16:31:30+03:00 |  |
| README.md | 基线同步（round 94） | smoke_market 31/31，合计 1010/1011；白皮书 §7.2 同步。 | done | 94 | 2026-11-01T16:31:30+03:00 |  |
| data/bg_import/::round94-none | 本次无背景库数据（round 94） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 94 | 2026-11-01T16:31:30+03:00 |  |
| plugins/market/validate.py | 新增插件校验打包核心（round 93） | validate(path) 固定 JSON（path/id/errors/warnings/checked_at/tool_version）；覆盖 manifest/README/INFO/schema/backend/feature 校验；错误码枚举稳定；pack 仅 ok 时打包到 data/backup/market_build/<id>.zip，排除 __pycache__/data 等并校验 zip；源目录只读。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| plugins/market/backend.py | 新增 validate-pack 路由（round 93） | POST /validate-pack/check 与 /pack；路径空/不存在/非目录返回错误码不 Traceback；与 scaffold/refresh 并列，不改既有路由。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| plugins/market/feature.js | 市场顶部“校验打包”面板（round 93） | 路径输入+datalist、校验/打包按钮、错误/警告分级、输出 zip 路径；不改卡片/开发插件/拉取逻辑；node --check 通过。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| tests/smoke_market.py | 校验打包测试（round 93） | 正例 plugins/market、缺 manifest/id、source 配对、tables 不一致、打包内容干净、失败拒绝、HTTP/Python 一致；29/29。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| docs/plugin-development-guide.md | 守则 §3/§4 写入必须校验（round 93） | §3 增加第 5 步校验（HTTP/Python，ok:true 才继续）；§4 检查清单加校验项；白皮书 §六补“必须通过 market 校验器”。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| plugins/market/README.md | 市场文档补校验打包（round 93） | 路由、结果结构、错误码/警告码、输出目录、只读源目录；市场草案与 INFO 同步。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| data/backup/market_build/ | 样例打包产物（round 93） | 对 plugins/market 自校验通过并打包，zip 26778 B；目录非 Git。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| data/bg_import/::round93-none | 本次无背景库数据（round 93） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 93 | 2026-11-01T16:24:31+03:00 |  |
| market/packages/ | 删除 18 个本地 zip，Release 成为唯一分发源（round 92） | 18 个 zip 全部删除；目录保留空目录；.gitignore 规则保留；docs 收敛为 Release 唯一源。 | done | 92 | 2026-11-01T14:57:43+03:00 |  |
| data/plugins/market/downloads/ | 清理 downloads 残留（round 92） | 无残留 zip；空目录保留。 | done | 92 | 2026-11-01T14:57:43+03:00 |  |
| README.md | 文档收敛 Release 唯一源（round 92） | README §5/§6/§12、白皮书 §7.1/§7.5、守则、市场草案、market README/INFO 统一：market/packages 空目录、脚本备用勿随意运行、公共库 2 从 Release 安装；移除 market/sources 与 18 包保留表述。 | done | 92 | 2026-11-01T14:57:43+03:00 |  |
| plugins/finance/INFO.md | 恢复 finance 为公共库分类（round 92） | 发现 finance INFO 回落为 local/false，恢复 source=market、market_package=true、known_limits Release；与 promptgen 一致。 | done | 92 | 2026-11-01T14:57:43+03:00 |  |
| data/bg_import/::round92-none | 本次无背景库数据（round 92） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 92 | 2026-11-01T14:57:43+03:00 |  |
| plugins/sim/ | sim 移回 plugins 并删除空 sources（round 91） | market/sources/sim → plugins/sim（含 INFO）；sources 空目录删除；INFO source=local、market_package=false；smoke_plugins 23 目录/185 断言、decoupling 476 断言同步。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| plugins/market/index_store.py | 双索引 remote/local 与旧文件迁移（round 91） | remote 覆盖式、local 组装式（扫描 INFO，21 条）；旧 index.json 迁移 finance/promptgen 到 remote、其余到 local 后删除；刷新只写 remote；下载目录 downloads/。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| plugins/market/backend.py | 四源合并/三类状态/下载安装（round 91） | 展示 INFO > remote > local；preset/market/local 分类；公共库从 download_url 下载到 downloads/，校验后解压并删 zip，失败保留；空地址 package_url_missing，未就绪 package_not_ready；本地开发不可安装。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| plugins/market/feature.js | 三类卡片与按钮（round 91） | 预置/公共库/本地开发徽标；本地开发无按钮；公共库安装/卸载；node --check 通过。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| plugins/*/INFO.md | 23 份 INFO source 三值（round 91） | preset 5、market 2（finance/promptgen）、local 16（含 sim）；market_package 与 source 语义一致；模板与 smoke_info_cards 同步；gen --check PASS。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| data/plugins/market/ | 运行态双文件迁移（round 91） | local_index.json 21 条、remote_index.json 2 条（finance/promptgen 包字段）；旧 index.json 已删除；运行态不进 Git。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| tests/smoke_market.py | 市场测试重写为双索引隔离用例（round 91） | 安全校验、双索引四源、三类状态、本地/下载安装、空地址、旧文件迁移、刷新只写 remote、失败保留 zip；21/21。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| tests/smoke_info_cards.py | INFO source 三值校验（round 91） | 允许 preset/market/local；market 必配 package true；remote package_ready 一致性；11/11。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| data/backup/market_upload/index.json | 待上传远程 index（2 条，round 91） | finance/promptgen 两条，version 2，含 sha256/size/file/download_url（GitHub Release v1）；不进 Git，供用户上传。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| README.md | 文档补双索引/三类/下载目录与基线（round 91） | README、白皮书 §7.2/7.5、守则、市场草案、market README/INFO 同步；全量 1000/1001（market 21、info 11、plugins 185、decoupling 476）。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| data/bg_import/::round91-none | 本次无背景库数据（round 91） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 91 | 2026-11-01T14:46:28+03:00 |  |
| tools/build_market_packages.py | 打包脚本支持 18 插件/排除/校验/回填运行态（round 90） | 17 个 plugins + sim 源；排除 __pycache__/*.pyc/.git/data/*.zip/*.tmp/.trash；现算 sha256/size/file；校验 zip 无路径穿越/排除目录；回填 data/plugins/market/index.json，不写 market/index.json；补包不升版。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| market/packages/ | 18 个非预置插件 zip 已生成（round 90） | 18 个 zip 生成并通过内容校验；zip 不进 Git，待用户上传 GitHub Release；`market/index.json` 保持 5 条模板。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| data/plugins/market/index.json | 运行态 index 回填 18 条包级字段（round 90） | sha256/size/file/package_ready:true 18 条；download_url 保持空；文件绝对路径 C:\Users\WJL\Desktop\Traveling_Tree\data\plugins\market\index.json。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| plugins/*/INFO.md | 18 份 INFO market_package=true 与 known_limits（round 90） | 17 plugins + sim 源设 true；预置 5 份保持 false；known_limits 注明待上传 Release 与 download_url 为空报错；gen --check 通过。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| plugins/market/backend.py | 安装包未就绪/空地址明确报错（round 90） | package_ready=false → package_not_ready；本地包缺失且 download_url 为空 → package_url_missing（包地址未配置）；不静默、不改其他安装逻辑。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| tests/smoke_market.py | 市场测试改用临时包并补空地址/未就绪用例（round 90） | 不依赖真实 market/packages；42/42；克隆模拟移走 packages 后仍全过。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| tests/smoke_info_cards.py | INFO market_package 与运行态一致校验（round 90） | true 的 id 必须出现在运行态 package_ready=true 集合；运行态缺失时跳过；10/10。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| README.md | 文档补 18 包/Release/download_url 口径（round 90） | README §5/§6、白皮书 §7.5、守则 §3/§4、市场草案、INFO 模板、market README/INFO 同步；基线 996/997（market 42/42、info 10/10）。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| data/bg_import/::round90-none | 本次无背景库数据（round 90） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 90 | 2026-11-01T14:00:52+03:00 |  |
| plugins/market/feature.js | 修复拉取按钮初始置灰不再更新的时序缺陷（round 89） | 新增 syncRefreshButton() 统一设置 #mk-refresh 的 disabled/title；在 render 初始化、refresh（loadList 完成/失败）finally、拉取成功/失败 finally 调用；不改变拉取/校验/列表/开发插件逻辑。配置存在时按钮可点、为空置灰，拉取后状态同步。 | done | 89 | 2026-11-01T01:04:03+03:00 |  |
| data/bg_import/::round89-none | 本次无背景库数据（round 89） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 89 | 2026-11-01T01:04:03+03:00 |  |
| market/index.json | market/index.json 改为 5 预置初始化模板（round 88） | 仅 5 预置；展示字段齐全，包级字段留空 + package_ready:false；作为克隆后运行态初值。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| data/plugins/market/index.json | 运行态 index 补为 23 条（round 88） | 5 预置 + 17 非预置 + sim；展示字段来自 INFO/manifest；包级字段空、package_ready:false；不进 Git，供用户上传 GitHub raw（绝对路径 C:\Users\WJL\Desktop\Traveling_Tree\data\plugins\market\index.json）。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| plugins/market/index_store.py | 新增 index 运行态/拉取/校验模块（round 88） | 首次请求从模板复制（不覆盖已有）；validate 校验结构/id/sha256/size/file/download_url/版本递增；仅 https；原子写入；失败不动本地。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| plugins/market/backend.py | 新增 /refresh-index 路由并接入运行态（round 88） | GET 状态/POST 拉取；/list 读运行态并返回 index_version/market_source_url；错误码 not_configured/network_error/http_error/invalid_structure/version_regression/insecure_url。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| plugins/market/feature.js | 市场“拉取最新插件”按钮（round 88） | 未配置 market_source_url 置灰；成功提示版本/条数并刷新列表；失败展示后端错误；不改卡片/开发插件逻辑。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| plugins/*/INFO.md | INFO.md 可选 icon 字段（round 88） | 23 份补 icon；模板可选 11 项；smoke_info_cards 校验 icon 存在时非空字符串；生成器 --check 全 PASS。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| tests/smoke_market.py | smoke_market 增补 B 阶段用例（round 88） | 初始化复制不覆盖、拉取成功升版、非法 JSON/缺字段/路径穿越/sha/回滚失败不动本地、not_configured、https 强制、非法模板拒绝；40/40。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| README.md | 文档补市场运行态/远程源与基线（round 88） | §6 market_source_url 与运行态；§9/守则检查清单；白皮书 §7.2/7.5、市场草案、market README/INFO 同步；smoke_market 40/40、smoke_info_cards 9/9，合计 993/994。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| data/bg_import/::round88-none | 本次无背景库数据（round 88） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 88 | 2026-11-01T00:43:56+03:00 |  |
| plugins/market/feature.js | 模板缺失时前端不再误报未设置下载地址（round 87） | 新增 devErrorCode；template_missing 时按钮保持可点、title 指向模板路径，展开面板展示后端真实错误；not_configured 仍置灰并提示先设置 download_dir。未改后端错误码与生成逻辑。 | done | 87 | 2026-11-01T00:06:25+03:00 |  |
| ui/web/static/app.js | 设置页 help 补浏览器下载独立性说明（round 87） | 通用下载地址（本地路径）帮助文案补：该路径仅用于插件服务端写盘；浏览器下载仍走浏览器/统一下载句柄，与该项相互独立。 | done | 87 | 2026-11-01T00:06:25+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书 §7.5 补浏览器下载独立性（round 87） | download_dir 条目补同句，与设置页/README 口径一致。 | done | 87 | 2026-11-01T00:06:25+03:00 |  |
| plugins/market/README.md | 市场 README 补 download_dir 语义（round 87） | 开发插件写盘说明标注仅用于服务端写盘，浏览器下载仍走浏览器/统一下载句柄。 | done | 87 | 2026-11-01T00:06:25+03:00 |  |
| data/bg_import/::round87-none | 本次无背景库数据（round 87） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 87 | 2026-11-01T00:06:25+03:00 |  |
| plugins/market/scaffold.py | 插件开发提示词生成并入市场（round 86） | 迁移模板解析/严格替换/残留检测；10 个占位符动态字段；写盘由 backend 统一处理；模板唯一源 docs/appendix/prompts/plugin-dev-prompt.md。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| plugins/market/backend.py | 新增 /scaffold/fields 与 /scaffold/generate（round 86） | GET 返回字段与下载地址配置；POST 严格校验 id/占位符后写盘 scaffold-<id>-<时间戳>.md；未设置/非绝对/目录不存在/无权限/模板缺失均明确错误；模板缺失不影响 /list 等既有接口。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| plugins/market/feature.js | 市场顶部“开发插件”按钮与动态表单（round 86） | 按后端字段渲染 input（全部短参数）；未设置 download_dir 时按钮置灰；缺失项标红；成功展示可复制路径；不改卡片/搜索/过滤逻辑。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| ui/web/server.py | 通用下载地址改为后端本地存储（round 86） | data/settings.json 新增 download_dir（绝对路径）；/api/settings 读写；设置页新增输入与保存。未设置/不可用时市场生成明确报错，不自动建目录。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| tools/scaffold_plugin.py | CLI 脚手架退役（round 86） | 删除 CLI；解析/替换逻辑迁入 plugins/market/scaffold.py；守则 §3 第 3 步、README/白皮书引用改为市场页“开发插件”。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| tests/smoke_market.py | smoke_market 增补开发插件用例（round 86） | 字段清单、生成文件名格式、缺值/路径穿越/未设置拒绝、模板缺失时市场其余接口正常；34/34。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| README.md | 补通用下载地址与开发插件文档、基线修正（round 86） | §6 写明 download_dir 键名/位置/用途/未设置行为；开发插件入口与模板依赖；smoke_market 34/34，合计 986/987；白皮书 §7.2/§7.5、守则 §3/§4 同步。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| data/bg_import/::round86-none | 本次无背景库数据（round 86） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 86 | 2026-10-31T23:48:12+03:00 |  |
| docs/appendix/plugin-info-card-template.md | 新增插件信息卡模板（round 85） | front matter 必需 9 项/可选 10 项、格式约定、正文固定结构、示例、校验口径；README 与 INFO.md 分工明确。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| plugins/*/INFO.md | 22 个插件目录 + sim 源共 23 份 INFO.md（round 85） | 每个插件 INFO.md 的 id/name/version/kind/has_ui/has_backend/db_module_key/routes_prefix/summary 与 manifest 一致，tables 与 schema 一致；sim 位于 market/sources/sim/INFO.md；敏感字段仅写路径类别。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| tools/gen_plugin_info_cards.py | 新增 INFO.md 生成/校验工具（round 85） | --check 校验必需字段、id、manifest/schema/backend 一致性与可选字段；生成模式不覆盖已有文件（--force 才覆盖）；无第三方依赖。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| tests/smoke_info_cards.py | 新增 INFO.md smoke（round 85） | 23 份齐全、解析、字段一致、summary、坏 front matter、sensitive 路径类别；8/8 PASS。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| plugins/market/backend.py | market 三源合并（INFO/源/index）（round 85） | /list 扫描 plugins/*/INFO.md、market/sources/*/INFO.md、index.json，以 id 去重；预置/已安装/可安装/缺包信息状态；坏 INFO 条目级错误不整体失败；包字段仍来自 index。feature.js 增信息源展示。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| docs/plugin-development-guide.md | 守则 §4.1 升级为 README 五节 + INFO.md 必需（round 85） | 增加 INFO.md 要求与模板链接；§4 检查清单新增 INFO.md 校验项。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| README.md | README/白皮书/矩阵同步 15 项基线与信息卡（round 85） | smoke_market 28/28、smoke_info_cards 8/8，合计 980/981；§4 目录说明与 §12 基线、白皮书 §7.1/7.2/十一、合规矩阵补 INFO 说明。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| data/bg_import/::round85-none | 本次无背景库数据（round 85） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 85 | 2026-10-31T20:23:16+03:00 |  |
| plugins/market/backend.py | testprobe 硬编码改为通用 test* 删表规则（round 84） | _test_tables(pid) 仅对 id 以 test 开头的插件读取其 schema 并收集 test_ 前缀表；uninstall(delete_tables) 仅在该条件下允许，先整库备份再删除；非 test* 或无 test_ 表一律拒绝，错误可读；去掉字符串 testprobe 硬编码。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| plugins/market/packaging.py | 删表函数注释明确正式/测试规则（round 84） | drop_test_tables 只接受 test_ 前缀表；注释写明正式卸载不删主库表、测试规则为唯一例外；未改函数行为。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| plugins/market/README.md | 市场 README 写明正式卸载规则（round 84） | 正式规则=卸载不 DROP 主库表；唯一例外 test* 插件 + test_ 表；删前整库备份；与代码一致。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| README.md | README 落 B3 源码公开决定与市场 UI 点测清单（round 84） | B3 改为“已决定接受公开：market/sources/ 与未来市场仓库源码可见，无敏感内容”；新增 9 条市场 UI 手动点测清单（入口、搜索、过滤、详情、预置、安装、卸载二次确认、删数据备份、重启）。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书基线同步与 B3 决定（round 84） | smoke_market 23/23、合计 967/968（TTS 502 唯一 FAIL）；§7.5 B3 改为已决定接受公开。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| docs/appendix/plugin-market-schema-draft.md | 市场草案补正式卸载规则与 B3 决定（round 84） | 删除不 DROP 主库表；test* + test_ 为唯一例外且先备份；B3 已接受源码公开。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| data/bg_import/::round84-none | 本次无背景库数据（round 84） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 84 | 2026-10-31T19:17:39+03:00 |  |
| plugins/market/backend.py | 市场源只读预留与测试表删除守卫（round 83） | settings() 只读 data/plugins/market/settings.json 的 market_source（默认 market/packages/）；uninstall 增加 delete_tables，仅 testprobe 验证钩子开放，其他插件拒绝且永不 DROP 主库表；backup_database 先整库备份再 drop_test_tables（仅 test_ 前缀）。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| tests/smoke_market.py | smoke_market 增补有表卸载用例（round 83） | 新增：非测试插件禁删表、整库备份含删除前表、仅删除 test_ 表、禁删非 test_ 表；smoke_market 22/22。临时有表插件链路验证后已删除，未提交。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| README.md | README 补克隆后打包说明与 B3 源码公开边界（round 83） | 市场章节：克隆后先跑 tools/build_market_packages.py 生成 zip，否则 sim 不可安装；market/sources/ 进 Git 表示源码可见，B3 独立市场仓库时源码可能公开，由用户后续决定。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书基线按实际 14 项修正并补 B3 边界（round 83） | §7.2 合计 966/967（13 项全 PASS，smoke_web 74/75 TTS 502 唯一 FAIL）；§7.5 补 market_source 默认本地与 B3 源码公开待确认。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| docs/appendix/plugin-market-schema-draft.md | 市场草案补 A 阶段配置与 B3 边界（round 83） | market_source 只读默认 market/packages/；B3 独立市场仓库源码公开需用户确认。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| data/bg_import/::round83-none | 本次无背景库数据（round 83） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 83 | 2026-10-31T18:55:45+03:00 |  |
| plugins/market/ | 新增插件市场（A 阶段本地包机制）（round 82） | manifest（导航型 entry nav:true）+ schema（market_installed，双列）+ backend（/list /index /status /install /uninstall）+ packaging（SHA256、路径穿越/绝对路径/符号链接/大小/文件数校验、临时目录、manifest.id 一致、原子安装）+ feature.js/plugin.css（卡片、搜索、kind 过滤、详情、预置不可卸载、删数据二次确认）。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| market/index.json | 本地市场包清单与构建脚本（round 82） | tools/build_market_packages.py 从 market/sources/<id>/ 生成固定时间戳 zip 并写 index（id/name/version/kind/desc/sha256/size/file/source/签名预留）；sim.zip 生成成功（12062 B，sha256 c60268b5…）；zip 已加入 .gitignore，index.json 进 Git。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| market/sources/sim/ | sim 试点迁移（方案 a，round 82） | plugins/sim 移至 market/sources/sim（源码进 Git，zip 不进 Git）；市场可安装/卸载/重装；真实库试点安装→卸载→重装→卸载通过，最终 sim 未安装（plugins 目录 22 个）。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| ui/web/static/app.js | 通用导航壳支持插件导航型 entry（round 82） | loadPlugins 将 entry.nav 分流为 PLUGIN_NAV；renderNav 动态插入 #nav；switchPage 增加 plugin: 通用页（#page-plugin + #nav-view）并加载 feature/style；不硬编码 market id，market 删除后入口消失且零 Traceback。server.py 的 _plugin_entry 透传 nav 字段。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| tests/smoke_market.py | 新增市场 smoke 与既有断言适配（round 82） | smoke_market 18/18：SHA256 一致、路径穿越/绝对路径/符号链接/id 不一致/重复安装拒绝、安装/卸载/重装、预置保护、删数据备份；smoke_plugins 183/183、smoke_startup_once 34/34、smoke_plugin_decoupling 454/454（TARGETS sim→market）；全量 14 通过（smoke_web 74/75 TTS 502 已知）。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| README.md | README 增市场说明、预置名单、基线更新与 russian 定位修正（round 82） | 补市场使用/打包/zip 不进 Git/重启/卸载删数据规则；13 项基线→14 项（183/34/454/18 等）；russian 明确非主体/非必装；白皮书 §7.1/§7.2/§7.3/§7.5、守则 §4.3、市场草案同步；合规矩阵补 market_installed（68 表）。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| data/bg_import/::round82-none | 本次无背景库数据（round 82） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 82 | 2026-10-31T18:43:21+03:00 |  |
| docs/appendix/project-acceptance-round80.md | 新增项目验收与结项文档（round 81） | 汇总验收结论、定位、架构、schema 合规（67/67、9 豁免、61 触发器）、13 项测试基线、round 65–80 提交链、round 75–81 备份、已知限制、未来方向与验收清单；数据来自已有文档与 round 80 实测，不读插件实现。 | done | 81 | 2026-10-31T17:57:52+03:00 |  |
| README.md | README 项目状态标记验收完成（round 81） | §12 增加验收完成条目，链接验收报告与合规矩阵；保留 round 79/80 历史条目。 | done | 81 | 2026-10-31T17:57:52+03:00 |  |
| tests/ | 验收轮全量 13 结果（round 81） | 12 项全 PASS；smoke_web 74/75（TTS 502 已知）；smoke_plugin_decoupling 452/452；合计 939/940。未改测试。 | done | 81 | 2026-10-31T17:57:52+03:00 |  |
| data/bg_import/::round81-none | 本次无背景库数据（round 81） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 81 | 2026-10-31T17:57:52+03:00 |  |
| tests/smoke_plugin_decoupling.py | 修复 Server.start 健康检查与 stop() 竞态（round 80） | 根因不同源：BadStatusLine 未被 http_get 捕获导致启动检查崩溃；stop() 进程退出竞态可抛 OSError。修复仅加异常捕获/日志与有限重试，不改 452 条断言、不改加载逻辑；连续 20 次 452/452 PASS。 | done | 80 | 2026-10-31T17:50:51+03:00 |  |
| docs/plugin-development-guide.md | 新增触发器维护约定（round 80） | 守则 §4.2：book_reader/finance/project_manager 触发器由各插件 migrate.py 生成（不写入 schema.sql）；加列后必须跑一次 migrate 重建；依赖 JSON1；新插件采用时需 README+migrate 说明；链接合规矩阵。 | done | 80 | 2026-10-31T17:50:51+03:00 |  |
| README.md | README 补无表插件说明与 round 80 收口状态（round 80） | §4 说明 13 个有 schema、9 个无表（cobuild/expdata/filejudge/netexp/pdf/rivet/sim/tts/webchat）；§12 标记 Server.start 修复、20 次通过、pending 清零。 | done | 80 | 2026-10-31T17:50:51+03:00 |  |
| tests/smoke_plugin_decoupling.py::Server.start | Server.start 连续 20 次验证（round 80） | 修复后 20/20 次 452/452 PASS，单次 104.6–129.1s，无 FAIL/超时；pending 清零。 | done | 80 | 2026-10-31T17:50:51+03:00 |  |
| data/bg_import/::round80-none | 本次无背景库数据（round 80） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 80 | 2026-10-31T17:50:51+03:00 |  |
| docs/appendix/plugin-schema-compliance-matrix.md | 新增 22 插件 schema 合规矩阵（round 79） | 13 个有 schema 的插件共 67 表全部合规；9 张豁免 live 均有 raw+注释；触发器覆盖 book_reader 22、finance 29、project_manager 10（按表 33 张）；无待修表。扫描曾误判 item_stats 注释，已改为按列定义解析。 | done | 79 | 2026-10-31T17:03:32+03:00 |  |
| plugins/project_manager/seed.py | 确认 pm seed/migrate 执行顺序与 seed 行 raw（round 79） | init_db 顺序：schema → 插件 migrate（创建触发器）→ 模块迁移 → seed；全新临时库验证 6 条模板行 raw/live 均非空、10 触发器，seed 行合规。 | done | 79 | 2026-10-31T17:03:32+03:00 |  |
| tests/smoke_plugin_decoupling.py::Server.start | 补 Server.start 根因待核实说明（round 79） | pending 描述补“两现象（健康检查超时、stop() 异常）是否同根因待核实；round 79 未修，留观察”；未改测试代码。 | done | 79 | 2026-10-31T17:03:32+03:00 |  |
| README.md | README 项目状态标记 schema 收口（round 79） | §12 增加 round 79 条目：67 表合规、9 豁免、61 触发器、矩阵链接；pending 仅 Server.start。 | done | 79 | 2026-10-31T17:03:32+03:00 |  |
| data/bg_import/::round79-none | 本次无背景库数据（round 79） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 79 | 2026-10-31T17:03:32+03:00 |  |
| plugins/finance/README.md | finance README 补触发器三点说明（round 78 确认） | 与 book_reader 对齐：JSON1 依赖（≥3.38）、加列需重建触发器、raw/live 由触发器维护业务 SQL 不显式写；原 README 缺此三点。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| data/backup/round78_db/ | 迁移前备份真实库（round 78） | 19255296 B，SHA256 F8DC093538660029ADD8F0A32DF4AA4028660C11D0A9573D66BC294BC49EBBFD，integrity_check=ok。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| plugins/pixel_art/schema.sql | pixel_art 3 表补 raw/live（round 78） | pixel_artworks raw+live；pixel_asset_refs/visual_settings 仅 raw（豁免 live，注释可重建）；写入 4 处显式同步（artworks insert/update、asset_refs upsert、visual_settings upsert）；新增 migrate 并声明；真实库 0 空 raw。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| plugins/project_manager/schema.sql | project_manager 5 表补 raw/live 与触发器同步（round 78） | 5 表 raw+live；用户确认触发器方案（4 INSERT + 15 UPDATE 含批量状态更新）；新增 migrate 并声明（保留 seed）；真实库 0 空 raw、10 触发器；旧库两次幂等。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| tests/smoke_plugin_decoupling.py::Server.start | Server.start 连续 10 次稳定性测试（round 78） | 10/10 次 452/452 PASS，单次 106–133s，未出现健康检查超时；不修代码，pending 保留并更新描述为“15+ 次未触发，留观察；本轮 10 次连续通过”。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| docs/appendix/file_navigation.json | round 78 pending 闭环：pixel_art/project_manager resolved，仅 Server.start 保留（round 78） | 关闭 pixel_art、project_manager；Server.start 保留并更新描述。全量 13 通过（smoke_web 74/75 TTS 502 已知）。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| data/bg_import/::round78-none | 本次无背景库数据（round 78） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 78 | 2026-10-31T16:57:49+03:00 |  |
| plugins/book_reader/README.md | 补 book_reader 触发器三点说明（round 77） | 说明 JSON1 依赖（≥3.38，本机 3.45）、加列需重建触发器（migrate 按 PRAGMA 生成）、raw/live 由触发器维护业务 SQL 不显式写；盘点文档同步。 | done | 77 | 2026-10-31T16:27:39+03:00 |  |
| data/backup/round77_db/ | 迁移前备份真实库（round 77） | 19103744 B，SHA256 80F869CB3E2C20038341F9C81E6522606C041BF94784578CAC2025A2F8E4827B，integrity_check=ok。 | done | 77 | 2026-10-31T16:27:39+03:00 |  |
| plugins/finance/schema.sql | finance 17 表补 raw/live 与豁免注释（round 77） | 12 张内容/日志表补 raw+live；finance_settings 与 4 张 *snapshot* 表仅 raw（豁免 live，schema 注释说明可重建来源）；quant_assets/fund_cache 已合规；新增 finance/migrate.py 并在 manifest 声明；触发器同步写入（先删后建，INSERT 填 raw/live、UPDATE/upsert 刷 live 保留 raw）；旧库幂等、真实库 17 表 0 空 raw、29 触发器。 | done | 77 | 2026-10-31T16:27:39+03:00 |  |
| docs/appendix/file_navigation.json | round 77 pending 闭环：finance resolved，2 条留 round 78（round 77） | 关闭 finance；保留 pixel_art、project_manager 与 Server.start。全量 13：12 项全 PASS；decoupling 首次 Server.start 健康检查超时，重跑 452/452 通过（已知偶发）。 | done | 77 | 2026-10-31T16:27:39+03:00 |  |
| data/bg_import/::round77-none | 本次无背景库数据（round 77） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 77 | 2026-10-31T16:27:39+03:00 |  |
| data/backup/round76_db/ | 迁移前备份真实库（round 76） | SQLite 在线备份 16285696 B，SHA256 1C5C4E247279BACCF23CB6F1BED1B073FB87D4B9F1812028D5C069231E355C1A，integrity_check=ok。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| plugins/book_reader/book_reader.py | 14 处位置式 INSERT 改显式列名（round 76 阶段 A） | 实际 14 处（非约 20）：books 2、sections 4、placeholders 2、sentences 3、marks 1、import_batches 1、cleaning_records 1；列名与参数顺序逐一对应，未改参数/语义；smoke_books 11/11、smoke_reader_range 25/25、smoke_web 74/75 通过。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| plugins/book_reader/schema.sql | book_reader 11 表补 raw/live 与写入同步（round 76 阶段 B） | 11 表补 raw+live（迁移快照）；reader_placeholders 仅 raw（豁免 live）、reader_bookmarks 已合规；写入同步用 AFTER INSERT/UPDATE 触发器（迁移按 PRAGMA 列生成、先删后建；INSERT 填 raw/live，UPDATE 刷 live 保留 raw），未改 47 处业务 SQL；旧库迁移两次幂等、真实库 11 表 0 空 raw、22 触发器。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| plugins/russian/repo.py | russian 主题级联刷新 items.live_json（round 76） | rename/delete/set_type 后刷新该主题下 items.live_json；items.raw_json 保持不变；临时库验证三次级联均正确。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| docs/appendix/file_navigation.json | round 76 pending 闭环：book_reader resolved，3 条留 round 77（round 76） | 关闭 book_reader；保留 finance、pixel_art、project_manager 与 Server.start。全量 13 通过（smoke_web 74/75 TTS 502 已知）。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| data/bg_import/::round76-none | 本次无背景库数据（round 76） | 用户未提供「项目优化与当前综述」导出 json；背景库不可用，本轮未执行 update 导入、未写背景库数据。 | done | 76 | 2026-10-31T15:32:35+03:00 |  |
| docs/appendix/plugin-audit-round74-schema-inventory.md | 6 插件 schema 全量盘点（round 75 阶段 A） | 49 表逐表核实：有 raw 4、缺 raw 45；有 live 3、缺 live 46；豁免 live 9（placeholders、item_stats、4 快照、finance_settings、pixel_asset_refs、visual_settings）。用户确认配置表豁免 live；第一批仅 bg_library+russian，book_reader 因位置式 INSERT 留 round 76。 | done | 75 | 2026-10-31T15:20:57+03:00 |  |
| data/backup/round75_db/ | 迁移前备份真实库（round 75） | SQLite 在线备份到 data/backup/round75_db/russian_tutor.db.bak，9023488 B，SHA256 8E526BB9C678EFE9AAC367CF71A6EA764195BA8EFA492A0A3FADF393CD6A6F58，integrity_check=ok；未读 DB 正文。 | done | 75 | 2026-10-31T15:20:57+03:00 |  |
| plugins/bg_library/schema.sql | bg_library + russian 第一批迁移（round 75 阶段 B） | bg_library 4 表补 raw+live、新增 migrate 并在 manifest 声明；russian 5 表补 raw，items/themes/review_logs/daily_logs 补 live，item_stats 豁免 live；写入路径同步（bg 4 处、russian items/review_logs/daily_logs/themes 等）；旧库迁移两次幂等、写路径实测 live==raw；真实库迁移后 8 表 0 空 raw。 | done | 75 | 2026-10-31T15:20:57+03:00 |  |
| docs/appendix/file_navigation.json | round 75 pending 闭环：bg_library/russian resolved，4 条留 round 76（round 75） | 关闭 bg_library、russian；保留 book_reader、finance、pixel_art、project_manager 与 Server.start；全量 13 通过（12 全 PASS，smoke_web 74/75 TTS 502）。 | done | 75 | 2026-10-31T15:20:57+03:00 |  |
| data/bg_import/::round75-none | 本次无背景库数据（round 75） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 75 | 2026-10-31T15:20:57+03:00 |  |
| docs/appendix/plugin-audit-round71.md | 审查报告追加 round 73 状态段（round 74） | 记录 G3 扩展结论（ai/pixel_art/webchat 补 provides，cobuild 不补）、4 插件写入路径结论（assets 双写；非 assets 表补 INSERT live_json）、model_usage_logs 原缺 raw/live 已补、pending 变化与全量 13 结果；未改其他段落。 | done | 74 | 2026-10-31T15:08:46+03:00 |  |
| plugins/schedule/repo.py | 4 插件保存回归通过（round 74 阶段 A） | 临时库写入→读回：schedule（assets/week_plans/tasks）、screeps（assets/units/modules）、urlarch（assets/groups/links）、promptgen（assets/flows/modules/tasks/flow_groups）均验证 live_json 非空且与 raw_json 一致；未写真实库，临时库用完即弃。 | done | 74 | 2026-10-31T15:08:46+03:00 |  |
| plugins/russian | 阶段 B 前置核实：核心表缺 raw_json，暂缓迁移（round 74） | B1 逐表核实 bg_library（4 表）、book_reader（11 表）、russian（5 表）均无 raw_json（book_reader 的 reader_placeholders 仅 raw、reader_bookmarks 双列），共 20 表。需先为结构化行/日志定义 raw 快照与回填规则并评估写入路径，超出本轮安全范围；阶段 B 留 round 75，未改任何 blocker schema。 | done | 74 | 2026-10-31T15:08:46+03:00 |  |
| data/bg_import/::round74-none | 本次无背景库数据（round 74） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 74 | 2026-10-31T15:08:46+03:00 |  |
| plugins/lib.json | G3 扩展核实：ai/pixel_art/webchat 补 provides，cobuild 不补（round 73） | ai 被 finance 调 keys/chat → provides=[ai]；pixel_art 被 book_reader 直接 import assets_payload → provides=[pixel_assets]；webchat 被 ai/aidebug/finance/promptgen 调用 → provides=[webchat]；cobuild 无插件调用、仅用户入口 → 不声明。manifest 已补三处；守则 §4 加示例；lib.json notes 同步。 | done | 73 | 2026-10-31T15:01:10+03:00 |  |
| plugins/schedule/repo.py | 4 插件 live_json 写入路径核实与补齐（round 73） | 结论：assets 均为 A（已双写）；week_plans/tasks、screeps units/modules、urlarch groups/links、promptgen flows/modules/tasks/flow_groups 为 B（只写 raw），已在 INSERT 中补 live_json（与 raw 同值）；读取仍沿用既有逻辑。未发现 C 类。 | done | 73 | 2026-10-31T15:01:10+03:00 |  |
| plugins/model_usage/schema.sql | model_usage_logs 补双列与写入（round 73） | 原表无 raw_json/live_json；已补两列（NOT NULL DEFAULT ''），migrate 幂等 ALTER+回填（临时旧库连跑两次通过），repo insert 写 raw/live、update 更新 live 保留 raw；smoke_model_usage 49/49。 | done | 73 | 2026-10-31T15:01:10+03:00 |  |
| docs/appendix/file_navigation.json | round 73 阶段 A 完成、阶段 B 留 round 74（round 73） | 阶段 A 全量 13 通过（12 全 PASS，smoke_web 74/75 TTS 502）；model_usage/webchat 两条 pending 关闭；保留 bg_library/book_reader/finance/pixel_art/project_manager/russian 6 条 blocker + Server.start。阶段 B（6 插件多表迁移与写入路径）未执行，留 round 74。 | done | 73 | 2026-10-31T15:01:10+03:00 |  |
| data/bg_import/::round73-none | 本次无背景库数据（round 73） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 73 | 2026-10-31T15:01:10+03:00 |  |
| docs/plugin-development-guide.md | G1–G6 口径落地守则（round 72） | G1 新增 §4.1 插件 README 格式（职责/入口与路由/数据表/依赖/注意事项）并加入检查清单；G2 检查清单要求豁免表列 raw_json/来源；G3 provides 必须、consumes 可选；G4 跨插件 import 需 README+lib.json notes 标注；G5 共享缓存例外与 G6 多入口命名在白皮书 §十.6/§十.7；§6 常见错误补两行。未改 §5 接口索引。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书补 G2–G6 规则与 README 要求（round 72） | §五补 G2 派生/日志/快照表口径；§十新增 10.4 provides 必须/consumes 可选、10.5 跨插件调用与标注、10.6 共享缓存例外、10.7 多入口 feature 命名建议；§十一补插件 README 强制条款。未改附录 A–E 语义。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| plugins/*/README.md | 补 22 个插件 README（round 72 G1） | 22/22 按固定五节生成：职责、入口与路由、数据表、依赖、注意事项；内容来自 manifest/schema 表名/backend handle 位置/lib.json；未读无关插件实现；未满足 G2 的表在 README 标注待 round 73。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| plugins/*/schema.sql::round72-live-json | 4 个插件补 live_json 与幂等 migrate（round 72 阶段 A5） | schedule（week_plans/tasks）、screeps（units/modules）、urlarch（groups/links）、promptgen（flows/modules/tasks/flow_groups）补 live_json TEXT NOT NULL DEFAULT ''；migrate 用 PRAGMA 检查 + ALTER + live=raw，临时旧库连跑两次幂等通过；全量 13 通过（仅 TTS 502）。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| docs/appendix/file_navigation.json | round 72 pending 闭环：7 条 resolved、8 条保留，阶段 B 留 round 73（round 72） | 已修复：schedule/screeps/urlarch/promptgen（schema+migrate）、cobuild/pdf/tts（README）共 7 条移入 resolved；保留 bg_library/book_reader/finance/model_usage/pixel_art/project_manager/russian/webchat 共 8 条并更新原因（README 已补，schema/provides 待 round 73）；Server.start 不变。阶段 B（6 blocker + webchat provides + model_usage 日志表）未执行。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| data/bg_import/::round72-none | 本次无背景库数据（round 72） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 72 | 2026-10-31T14:51:28+03:00 |  |
| docs/appendix/plugin-audit-round71.md | 新增 22 插件规范性审查报告（round 71） | 依据守则第 4 节、白皮书正文与附录 A–E、plugins/lib.json；逐插件给出合规/缺失（blocker/should/nice）/建议/规则缺口。结论：blocker 插件 10 个、should-only 5 个、需 round 72 修复 15 个、无需修复 7 个；规则缺口 6 条（G1–G6）。仅通读 webchat/tts/ai/cobuild 四个 backend.py；其余 18 个只核对 def handle 存在性，未读正文。 | done | 71 | 2026-10-31T14:42:02+03:00 |  |
| docs/appendix/interfaces/ | 新增 4 份插件接口契约（round 71） | webchat（8 子路径）、tts（2，含 __binary__ 音频响应）、ai（keys/chat/state）、cobuild（data/checkin/void）；含方法、入参、返回概要、错误码与调用方；无法从代码确认的返回字段标“需执行 Agent 核实”。 | done | 71 | 2026-10-31T14:42:02+03:00 |  |
| docs/plugin-development-guide.md | 守则第 5 节接口索引改指向契约（round 71） | 接口表新增 ai/cobuild 两行并把“接口正文”改为 docs/appendix/interfaces/<id>.md；约定改为优先读契约、无契约读 backend.py::handle；未改其他章节与检查清单。 | done | 71 | 2026-10-31T14:42:02+03:00 |  |
| data/bg_import/::round71-none | 本次无背景库数据（round 71） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 71 | 2026-10-31T14:42:02+03:00 |  |
| docs/plugin-development-guide.md | 新增插件开发守则（round 70） | 按开发者动线组织 7 节（快速开始/信息导航/开发流程/检查清单/接口索引/常见错误/参考实现）；规则引用白皮书 §二–§六、附录 A–E、§十，不重复条文；接口索引只列路由前缀与 called_by，不抄签名；常见错误含 plugins/lib/ 扫描（round 67）与批处理 LF（round 69）教训。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| docs/appendix/prompts/plugin-dev-prompt.md | 新增插件开发提示词模板（round 70） | 含目录与 10 个占位符（PLUGIN_ID/PLUGIN_NAME/PLUGIN_KIND/HAS_UI/ENTRY_OR_BACKEND/DEPENDS_ON_LIB/NEEDS_DB/NEEDS_DATA_DIR/PROVIDES/TARGET_DIR）；要求先列假设与待确认项、确认后再写代码；涉及下沉/平级插件先读接口索引；不复制白皮书全文。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| tools/scaffold_plugin.py | 新增插件脚手架脚本（仅占位符替换，round 70） | 读取模板并替换占位符；参数含 --id/--name/--kind/--has-ui/--entry-or-backend/--depends-on/--needs-db/--needs-data-dir/--provides/--target-dir/--out；--id 校验 ^[a-z][a-z0-9_]*$；未知占位符保留并警告；缺失必填报错退出非零；默认输出 data/backup/scaffold/<id>-prompt.md，--out - 输出 stdout；拒绝写入 plugins/；不 import 项目模块、不跑 smoke。验证：--help 可用、示例运行占位符全部替换、非法 id 退出 2。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| docs/appendix/plugin-market-schema-draft.md | 新增插件市场数据库设计草案（round 70） | 标注草案、未建表；未来落 plugins/market/schema.sql，内容表须含 raw_json/live_json；数据来源本地优先、远端可选，预留 source/source_url/fetched_at；草案含 market_plugins、market_versions、market_interfaces、market_deps、market_categories 五表字段级定义与来源标注；id/kind/has_ui/called_by 以 plugins/lib.json 为单一真相；待定项含存储位置、是否复用 lib.json、远端协议。未建插件、未写 SQL。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书补工程约束并加开发者文档索引（round 70） | 核对后补缺失规则：新增 §十（provides/consumes 可选声明与“需执行 Agent 核实”的宿主强制程度；plugins/ 目录扫描边界与 plugins/lib.json 单文件；批处理必须 CRLF）；新增 §十一 索引（守则、提示词模板、脚手架、市场草案、plugins/lib.json）。未改 §一–§九 与附录 A–E 语义。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| README.md | README 增加插件开发入口（round 70） | §9 开发约定首条指向守则/提示词模板/脚手架/市场草案；§11 文档新增守则、模板、市场草案链接；链接 0 失效。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| data/bg_import/::round70-none | 本次无背景库数据（round 70） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 70 | 2026-10-31T14:21:54+03:00 |  |
| webchat_probe.py | 删除（round 59 后路径失效，正式通道为 plugins/webchat/） | 删除前核实：脚本 PROFILE 仍指向项目根 webchat_profile/（round 59 已迁 data/plugins/webchat/webchat_profile/），并硬编码示例会话 URL 与旧选择器；无运行入口、config 或启动脚本引用，正式网页会话通道为 plugins/webchat/。确认失效后删除。备份 data/backup/round69_cleanup/webchat_probe.py.bak（4330 B，SHA256 243DF7E2BFB55A5609D2A4F1604E5A48215EC4EA15DFE0BBBA33E7B385302F6A）。历史 decided 中 webchat_probe 旧记录保留不改。 | deleted | 69 | 2026-10-31T13:29:56+03:00 | data/backup/round69_cleanup/webchat_probe.py.bak |
| tools/启动旅行之木.cmd | 启动脚本迁至 tools/ 并修正相对路径（round 69） | 同盘移动，文件名不变；cd /d "%~dp0" → "%~dp0.."；两处 main.py 路径 → "%~dp0..\main.py"；pythonw 优先/python 回退逻辑与失败提示未改；无盘符/用户名硬编码。验证：cmd /c tools\启动旅行之木.cmd 后 8765 成功监听。历史 decided 中指向项目根该脚本的 path 字段与正文提及已统一为 tools/启动旅行之木.cmd，仅指该脚本处；历史 round/at/status 未改。 tools/启动旅行之木.cmd 必须保持 CRLF 行尾；LF 行尾会导致 cmd 解析异常（本轮已复测并恢复 CRLF）。 | done | 69 | 2026-10-31T13:29:56+03:00 | data/backup/round69_cleanup/ |
| README.md | README 同步启动脚本新路径并移除 webchat_probe 表述（round 69） | 快速开始改为 tools\启动旅行之木.cmd 并说明 %~dp0..；目录树移除根目录 webchat_probe.py 与根启动脚本、新增 tools/；删除 webchat_probe 保留建议。白皮书与 plugins/lib.json grep 无 webchat_probe / 启动旅行之木 命中，未改；.gitignore 未列两者，未改。files_manifest 为快照未重导出，仍含旧条目。链接 0 失效。 | done | 69 | 2026-10-31T13:29:56+03:00 |  |
| data/bg_import/::round69-none | 本次无背景库数据（round 69） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。 | done | 69 | 2026-10-31T13:29:56+03:00 |  |
| plugins/russian/manifest.json | 插件展示名由「旅行之木」改为「俄语单词背诵」（round 68） | manifest.name 与 entries[0].name 改为「俄语单词背诵」；插件 id=russian、entry id、feature/backend/db/style/data_dirs 均未改。插件卡片与页面标题随之显示新名。项目整体名「旅行之木 / Traveling_Tree」不变。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| plugins/russian/feature.js | russian 插件页面品牌文案更新（round 68） | 仅改用户可见标题「🇷🇺 旅行之木」→「🇷🇺 俄语单词背诵」；文件头与模块分隔注释未改，函数名、变量名、localStorage 键、导出名与数据标识均未改。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| plugins/russian/plugin.css | russian 插件样式注释更新（round 68） | 仅注释「旅行之木学习核心」→「俄语单词背诵学习核心」；选择器、类名、变量名与样式规则未改。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| README.md | README 中插件名与项目名区分（round 68） | 逐处判定 6 处「旅行之木」：标题、项目简介、启动脚本名（2 处）、白皮书标题保留为项目名；§5 功能小节标题改为「俄语单词背诵」（指 russian 插件）。未做全局替换；链接 0 失效。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| plugins/lib.json | 分类清单同步插件新名（round 68） | russian 条目 notes 由「旅行之木学习核心」改为「俄语单词背诵学习核心」；kind=functional、has_ui=true、called_by 不变。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| docs/appendix/file_navigation.json | 历史名称文本统一为「俄语单词背诵」（round 68） | 历史 decided 中仅 1 条（2 处文本）指 russian 插件 UI 的「旅行之木 hub」（ui/web/static/features/russian.js）改为「俄语单词背诵 hub」；其余「旅行之木」均指项目整体或启动脚本名（tools/启动旅行之木.cmd），保留。历史 round/at/status 字段未改。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| docs/plugin-development-whitepaper.md | 白皮书核对：无插件旧名需改（round 68） | 全文 3 处「旅行之木」（标题、最高准则、核心理念）均指项目整体，保留；§7.1 与附录 E 仅列插件 id=russian，不使用中文展示名。本次未改白皮书。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| data/bg_import/::round68-none | 本次无背景库数据（round 68） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入背景库数据。名称判定依据为代码与说明性文档上下文。 | done | 68 | 2026-10-30T16:50:33+03:00 |  |
| plugins/lib.json | 新增插件分类清单（22 条，round 67） | 按「有卡片=functional、无卡片=library、cobuild 例外归 functional」生成 22 条（functional 20 / library 2，has_ui=true 19），字段 id/kind/has_ui/called_by/notes。因 tests/smoke_plugins.py 把 plugins/ 下任意目录计入插件目录数（要求恰好 22），经用户确认改用单文件 plugins/lib.json；原计划的 plugins/lib/manifest.json 会使目录数变 23 并触发 manifest 缺失/目录数 FAIL。未改宿主扫描/import/路由与任何测试；该文件仅作文档索引，宿主、测试与插件运行时不读取。验证：smoke_plugins 181/181、smoke_file_preview 17/17。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| docs/plugin-development-whitepaper.md | 新增附录 E：底层下沉插件（round 67） | 附录 E 记录分类口径、当前清单（webchat、tts；cobuild 例外）、调用关系摘要、单插件文档索引、未来物理移动风险（仅说明不执行）；未改附录 A–D 内容与原章节编号，仅开头索引提及附录 E。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| docs/appendix/lib/webchat.md | 新增 webchat 底层插件说明（round 67） | 记录职责、8 条 /api/plugin/webchat/* 子路径、调用方（ai/aidebug/finance/promptgen + 宿主 app.js 与共享 webchat.js）、依赖（Playwright/浏览器二进制/profile）、注意事项与不面向用户说明；与 plugins/lib.json 的 called_by 一致。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| docs/appendix/lib/tts.md | 新增 tts 底层插件说明（round 67） | 记录职责、/speak 与 /clear-cache 接口、调用方（app.js；russian 间接）、依赖（edge-tts/系统语音/data/voice_cache）、注意事项（TTS 502 已知、__binary__ 格式）与不面向用户说明；与 plugins/lib.json 的 called_by 一致。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| README.md | README 增加插件分类指引（round 67） | §4 新增「插件分类」小节：分类口径、plugins/lib.json 链接、webchat/tts 文档链接、白皮书附录 E 链接；不展开长表，未改无关章节。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| data/bg_import/::round67-none | 本次无背景库数据（round 67） | 用户未提供「项目优化与当前综述」导出 json；背景库当前不可用，本轮未执行 mode:"update" 导入、未写入任何背景库数据。分类依据为 plugins/*/manifest.json 与 import/API 调用行。 | done | 67 | 2026-10-30T14:49:23+03:00 |  |
| docs/plugin-development-whitepaper.md | 补 round 65 删除前核对结论（round 66） | 逐项核对：v2.1 草案 backend-only → docs/appendix/A-backend-only.md（A.1–A.4）；根路由 → B-root-routing.md；__binary__ 格式 → C-binary-format.md；import 约定 → D-conventions.md（shared_features/db.migrate 仍标待确认）。结项报告 22 插件清单 → 白皮书 §7.1；13 smoke 基线 → §7.2；剩余 pending → §7.3；交接建议 → §7.4。未发现未覆盖项，未恢复已删文档；核对表落在白皮书 §7.6，README §12 加摘要。 | done | 66 | 2026-10-30T13:35:18+03:00 |  |
| docs/appendix/file_navigation.json | 更正 round 65「无 resolved[]」的错误说法（round 66） | 核实顶层 keys = schema_version / generated_at / round / pending / decided / resolved；resolved[] 现有 29 条，字段为 path、move_plan、guide_plan、summary、round、created_at、resolved_at、resolved_round、resolution。round 65 汇报「schema 只有 pending/decided」有误。本次无新增 resolved 项，原因是 docs/ 下无未闭环临时文件，而非 schema 缺失；未改 schema，未改历史记录。 | done | 66 | 2026-10-30T13:35:18+03:00 |  |
| docs/appendix/files_manifest.json | files_manifest 保持快照，不重导出（round 66） | 按用户选择 A：保持 2026-10-29 导出的快照，不重跑 file_preview 导出，不手写清单。README §4 与白皮书 §9 已标注「非实时索引，文件变动后需重新导出」。快照仍含已删的两份文档条目、不含新增 appendix 文件，属预期；字段结构未改。 | done | 66 | 2026-10-30T13:35:18+03:00 |  |
| .git | round 65 改动提交并 push（round 66 确认） | 按用户选择 A：git add -A 让 Git 识别 rename（file_navigation.json R098、file_navigation.md R095、files_manifest.json R099），提交 0aa8b21（13 files changed、263 insertions、308 deletions），push a521afd..0aa8b21 成功，origin/main = 0aa8b21。提交前确认无 data/、ai_keys、webchat_profile、.db、rt_fin；round 66 的文档更新与打卡镜像在该提交之后产生，暂未提交。 | done | 66 | 2026-10-30T13:35:18+03:00 |  |
| docs/appendix/ | 三份说明性文件移入 docs/appendix/ 作为白皮书附件（round 65） | docs/appendix/file_navigation.json、docs/appendix/file_navigation.md、docs/appendix/files_manifest.json 由项目根同盘移动到 docs/appendix/，移动前后字节数与 SHA256 一致（296601 / 175512 / 110376 B）。三者相对项目根的路径语义不变；项目根不再保留同名文件。历史记录中的路径文本已统一为 appendix 路径（见下一条）。 | done | 65 | 2026-10-30T13:21:38+03:00 | data/backup/round65_docs/ |
| docs/appendix/A-backend-only.md | 白皮书附录 A–D 拆为 appendix 附件（round 65） | 从 docs/plugin-development-whitepaper.md 抽出附录 A–D 全文，分别写入 docs/appendix/A-backend-only.md、B-root-routing.md、C-binary-format.md、D-conventions.md；白皮书正文改为标题 + 一句话 + 相对链接索引，原章节编号与附录语义不变。 | done | 65 | 2026-10-30T13:21:38+03:00 | data/backup/round65_docs/ |
| docs/plugin-development-whitepaper-v2.1-draft.md | 删除 v2.1 草案与结项报告（round 65） | 核对确认草案的 backend-only、根路由、__binary__ 修正、import 约定已全部并入白皮书附录 A–D；结项报告的 22 插件清单、13 smoke 基线、剩余 pending、交接建议已并入白皮书 §7 与 README §12。两份文件删除，备份于 data/backup/round65_docs/。docs/ 根现仅白皮书 + 多AI共建日志 + appendix/。 | done | 65 | 2026-10-30T13:21:38+03:00 | data/backup/round65_docs/ |
| tools/gen_file_navigation_md.py | 三文件名硬编码统一为 docs/appendix/ 路径（round 65） | 生成器 SOURCE/TARGET 改为 docs/appendix/file_navigation.json 与 docs/appendix/file_navigation.md；README 链接/目录树、白皮书引用、file_navigation 历史正文、files_manifest 条目与 purpose 均改为 docs/appendix/ 前缀（未重跑导出，仍为快照语义）。files_manifest 的 file_name 保持 basename；file_preview 前端导出下载名保持 files_manifest.json（下载 basename，非项目路径）；docs/多AI共建日志.md 为自动镜像不手改，历史打卡条目保留原文；.gitignore 与 tests 无相关硬编码，无需改。 | done | 65 | 2026-10-30T13:21:38+03:00 | data/backup/round65_docs/ |
| README.md | README 与白皮书补充文件分工、docs 闭环与项目状态（round 65） | README 新增「说明性文件分工」（§4）与「项目状态与交接」（§12），§9 开发约定写入 docs 临时文件闭环规定，§11 文档补附录与说明性文件链接；另将 3 处指向已归档文件（plugin-standard-v1.md / plugin-css-decision-2026-10-28.md，round 33/34 已移出项目）的死链改为白皮书链接；白皮书新增 §7 项目状态与交接、§8 docs 目录与临时文件闭环、§9 白皮书附件。docs/ 下无未闭环临时文件，故不新增 pending。 | done | 65 | 2026-10-30T13:21:38+03:00 |  |
| . | 项目目录改名 russian_tutor → Traveling_Tree（round 64） | 物理目录 C:\Users\<用户名>\Desktop\russian_tutor\ 改为 C:\Users\<用户名>\Desktop\Traveling_Tree\。config.BASE_DIR 基于 __file__ 自动跟随；启动脚本用 %~dp0 自动跟随；.git、data/、GitHub remote 均不受影响。数据库文件名仍为 russian_tutor.db（内部文件名，与目录名解耦，不改）。README 中项目名引用已更新；历史 round 记录保留旧名。验证：smoke_plugins 181/181、smoke_startup_once 33/33、smoke_web 74/75（TTS 502 已知）、启动无 Traceback、git push 成功。 | done | 64 | 2026-10-29T22:53:36+03:00 |  |
| plugins/pdf/feature_batch.js | 示例路径个人用户名替换为 <用户名>（round 64） | 公开前文案扫描发现唯一建议清理项：示例路径含个人用户名。已替换为 <用户名>，不影响功能。 | done | 64 | 2026-10-29T22:28:28+03:00 |  |
| docs/appendix/file_navigation.json::public-scan-round64 | 公开前文案扫描结论（round 64） | 扫描 125 个代码/文档文件：必须清理 0 项；建议清理 1 项（plugins/pdf/feature_batch.js:25 示例路径含个人用户名，建议替换为 <用户名>）；可接受 164 项（detailstop 3 处为仓库 owner；AI agent 名 161 处为多 AI 协作记录）。绝对路径 0、个人邮箱 0、手机号 0、具体地址 0、真实 token URL 0；money 15 与 sensitive_url 42 为代码/模板误报，不是个人财务值或真实凭据。docs/多AI共建日志.md 的 agent 名为 DSH、DeepSeek Harness、Codex · GPT-5（DeepSeek Harness 扮演），无真实姓名；适合公开。结论：无必须清理项，可考虑转 public；建议在公开前匿名化个人用户名。 | done | 64 | 2026-10-29T22:24:17+03:00 |  |
| data/backup/::round61-63_temp | 清理 round 61–63 临时备份（round 64） | round59_docs_post_move（3 文件/304,546 B）、round60_rt_fin（4/119,341 B）、round61_clean_start（10/618,121 B）、round62_git_init（2/303,139 B）、round63_push（2/292,890 B）共 5 个临时目录已清理，释放 1,638,037 B。这些是 round 61–63 的改前快照，commit 均成功、工作区 clean，回滚价值归零。data/ 在 .gitignore，清理不产生 Git 变更；data/backup/ 现为空目录。历史 decided 中 backup_path 指向这些目录的记录保留为历史（路径已不存在）。 | done | 64 | 2026-10-29T22:24:17+03:00 |  |
| .git::remote | 配置远程仓库并 push（round 63，私有） | remote origin = https://github.com/detailstop/Traveling_Tree.git；本地 commit 9c63178（181 文件）+ c7ffd42（round 62 docs）；用户手动 push 成功，remote HEAD = c7ffd4209dcff0184be2727bc7608443c6a04b9c；agent 环境非交互，无法输入 PAT，故 push 由用户手动完成；PAT 存于 Windows 凭据管理器，后续 agent push 无需交互。 | done | 63 | 2026-10-29T22:17:12+03:00 | data/backup/round63_push/ |
| data/ai_cobuild.json::round61_two_checkins | round 61 两次打卡说明（保留，不作废） | round 61 阶段 6 完成后先打卡（#55，21:49），补完 README 后最终打卡（#56，21:53）。两条均为真实操作记录，内容不同，非重复提交；count 54→56 的 +2 由此解释。按只追加原则保留。 | done | 62 | 2026-10-29T21:59:19+03:00 |  |
| .git | 初始化 Git 仓库（round 62，私有） | git init -b main；首次 commit 哈希 9c63178；181 文件（Python 88 / JS 25 / Markdown 6 / 插件目录 141）；.gitignore 排除 data/、data_path.txt、rt_fin.json、webchat_profile/、__pycache__ 等；git status clean；git ls-tree 确认无敏感路径。远端：待 round 63。 round 63 已配置 remote https://github.com/detailstop/Traveling_Tree.git，用户手动 push 成功（agent 环境无法交互输入 PAT）；remote HEAD = c7ffd4209dcff0184be2727bc7608443c6a04b9c；main 跟踪 origin/main。认证方式：PAT 存于 Windows 凭据管理器。 | done | 62 | 2026-10-29T21:59:19+03:00 | data/backup/round62_git_init/ |
| README.md | round 61 补充数据目录与克隆说明 | 第 6 节加首次启动自动建库说明；第 7 节风险提示加 webchat_profile 克隆后为空需重新登录。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| .gitignore | 新建（round 61） | data/ 留在项目内本地用，.gitignore 排除 data/、rt_fin.json、__pycache__ 等。克隆项目后启动，config.py 自动建 data/，init_db 扫描 plugins/*/schema.sql 建表并播种；干净启动测试已通过。webchat_profile 被忽略，克隆者需重新扫码登录（README 已说明）。不创建 data_path.txt（data/ 不搬家）。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| docs/appendix/file_navigation.json::工艺教训-round61 | SQLite 恢复后验证判据修正 | round 61 阶段 5.4 原设计要求恢复后 SHA256 与基线一致，但阶段 5.5 又要求启动服务验证，两者矛盾：SQLite 启动必改 header 元数据。后续同类任务改为：先 PRAGMA integrity_check + 表行数对比，再启动服务；SHA256 仅用于字节级备份完整性（如 rename 前后），不用于 SQLite 恢复判定。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| data/russian_tutor.db | round 61 启动验证后 SHA256 变化，完整性检查通过（接受当前 DB） | 阶段 5.4 用 SHA256 判定恢复失败，但 SQLite 启动会重写 header 元数据（change counter / schema cookie / checkpoint），字节哈希必然变。完整性检查：PRAGMA integrity_check=ok；83 表；items 23 / item_stats 23 / themes 2 / bg_nodes 81 / file_notes 165 / bg_versions 84 / finance_accounts 15 / finance_snapshots 28，均 >= round 28 基线；items ID 168-190 连续无空洞；page_count 2098 * page_size 4096 = 8,593,408 B 精确等于文件大小；freelist 3 页（0.14%）。无需从备份恢复。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| tests/smoke_finance.py | 迁移测试输入路径同步 | INPUT 由 ROOT/plugins/finance/fixtures/rt_fin.json 改为 ROOT/data/plugins/finance/fixtures/rt_fin.json；smoke_finance 34/34。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/smoke_finance.py.bak |
| plugins/finance/migrate_localstorage.py | 迁移默认输入改插件数据目录 | INPUT 由 ROOT/plugins/finance/fixtures/rt_fin.json 改为 config.plugin_data_dir("finance")/fixtures/rt_fin.json；dry-run 可定位新文件，未执行 apply。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/migrate_localstorage.py.bak |
| plugins/finance/fixtures/rt_fin.json | 移出代码目录到 data/plugins/finance/fixtures/（数据隔离） | 含真实财务数据，属个人数据；同盘 rename 到 data/plugins/finance/fixtures/rt_fin.json，99,533 B，SHA256 0dac386c8ed81765324692d86f33562f6097d7cd9ff1d9d454cc12090238094e 前后一致；旧 fixtures/ 已空并删除。file_preview 的 EXCLUDE_FILE_GLOBS 含 rt_fin.json，按 basename 匹配，新路径继续排除。smoke_finance 34/34、smoke_file_preview 17/17；dry-run RC0 定位新路径。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/ |
| docs/appendix/file_navigation.json::historical_paths | 历史路径指针说明（round 59） | round 59 将 归档/ 与 data/backup/ 整体移出项目。decided 中 59 条 backup_path 以 data/backup/ 开头、11 条 new_path 以 归档/ 开头、3 条 path 为 归档/、48 条 reason/decision 正文提及这两路径，均为历史记录，路径已不存在，不再逐条修改。若需追溯，按 round 编号从项目外归档目录取回。 | done | 59 | 2026-10-29T21:03:37+03:00 |  |
| data/backup/ | 整体移出项目（用户手动，round 59） | 用户决定精简项目后初始化 Git。data/backup/ 下 38 个 round 目录（159 文件/48 目录/11,714,956 B）整体移出，含 round59_webchat_profile/keep/（36 个登录态副本）、host_zero_batch8 完整备份、各轮 decoupling/smoke 日志。移出后 data/backup/ 仅保留本任务新建的 round59_docs_post_move/（临时备份）。登录态唯一副本为 data/plugins/webchat/webchat_profile/ 本体，阶段 0 已核对 36/36 哈希一致，用户接受无冗余。file_preview 的 EXCLUDE_REL_DIRS 仍含 "data/backup"，规则保留。历史 decided 中 backup_path 指向 data/backup/ 的 59 条保留为历史，路径已不存在，见任务 1.3 全局说明。 | done | 59 | 2026-10-29T21:03:37+03:00 |  |
| 归档/ | 整体移出项目（用户手动，round 59） | 用户决定精简项目后初始化 Git。归档/（44 文件/10 目录/12,953,868 B）含 data/、docs/（含 10 个 bg-update-*.json）、modules/ 及历史敏感文件副本，整体移出到项目外。移出后项目根不再有 归档/。file_preview 的 EXCLUDE_DIR_NAMES 仍含 "归档"（规则保留，未来若重建仍排除）。历史 decided 中 new_path 指向 归档/ 的 11 条、path 为 归档/ 的 3 条保留为历史，路径已不存在，见任务 1.3 全局说明。 | done | 59 | 2026-10-29T21:03:37+03:00 |  |
| data/plugins/webchat/ | file_preview 呈现检查（round 59） | file_preview state 返回 200；树中出现 data/plugins/webchat 目录节点，children=0（webchat_profile 被 EXCLUDE_DIR_NAMES 排除，父目录显示为空属预期）；扫描 counts.files=188，与 files_manifest items=188 一致；未修改 file_preview.py，未加新排除。 | reviewed | 59 | 2026-10-29T20:42:25+03:00 |  |
| plugins/webchat/manifest.json | data_dirs 声明 webchat | data_dirs 由 [] 改为 ["webchat"]，宿主启动时确保 data/plugins/webchat/ 存在；profile 子目录由同盘 rename 迁入。 | done | 59 | 2026-10-29T20:35:39+03:00 | data/backup/round59_webchat_profile/manifest.json.B.bak |
| plugins/webchat/web_chat.py | profile 路径改为插件数据目录 | _PROFILE_DIR 由 config.BASE_DIR/webchat_profile 改为 config.plugin_data_dir("webchat")/webchat_profile；目录名保持 webchat_profile，file_preview 排除规则不变。 | done | 59 | 2026-10-29T20:35:39+03:00 | data/backup/round59_webchat_profile/web_chat.py.round59_b.bak |
| webchat_profile/ | 迁移到插件数据目录（round 59） | C：同盘 rename webchat_profile → data/plugins/webchat/webchat_profile；214 文件/52 目录/14,110,791 B 前后一致；36 个关键登录态文件 SHA256 与 keep/ 一致。web_chat.py 改用 config.plugin_data_dir("webchat")/webchat_profile；manifest.data_dirs=["webchat"]。只读 status/sessions 正常（ready=True，sessions=1）；smoke_web 74/75、smoke_plugins 181/181、data_dirs 13/13、file_preview 17/17、全量 13 通过。 | done | 59 | 2026-10-29T20:35:39+03:00 | data/backup/round59_webchat_profile/ |
| webchat_profile/ | 瘦身（删除可重建缓存，保留登录态） | round 59 B：profile 143,029,590 B → 14,110,791 B，释放 128,918,799 B（122.95 MB）；文件 658→214，目录 68→52。删除 Default/Cache、Code Cache、GPUCache、ShaderCache、GrShaderCache、Dawn*、Crashpad；Service Worker/CacheStorage 与 GraphiteDawnCache 不存在。keep/ 中 36 个关键登录态文件 SHA256 全部一致；启动 webchat 只读 status/sessions 正常（ready=True，sessions=1），smoke_web 74/75（仅 TTS 502）。 | done | 59 | 2026-10-29T20:31:41+03:00 | data/backup/round59_webchat_profile/ |
| README.md | 插件数量表述更新（19 → 22） | round 57 结项后实际为 22 个插件目录（19 有卡片 + 3 backend-only）。修正当前状态描述：目录树、manifest v2 覆盖数、卡片数说明；同时修正过时的 modules/ 宿主能力描述、server.py 的 TTS 标注、Web 朗读旧路径 /api/tts。历史 round 记录中的“19 个插件”保留不改。备份 data/backup/round58_docs/README.md.bak。 | done | 58 | 2026-10-29T20:20:16+03:00 | data/backup/round58_docs/README.md.bak |
| docs/project-closure-2026-10-29.md | 新建·项目结项报告 | round 57 收尾；汇总架构、数据、测试、已完成动作、剩余 pending、交接建议。 | done | 57 | 2026-10-29T20:17:07+03:00 |  |
| docs/plugin-development-whitepaper-v2.1-draft.md | 草案已合并·保留历史对照 | 草案开头已标注“已于 2026-10-29 合并到 v2.0 附录 A–D”，正文保留作历史对照。 | done | 57 | 2026-10-29T20:17:07+03:00 |  |
| docs/plugin-development-whitepaper.md | v2.1 合并（附录 A–D） | v2.1 草案的 backend-only、根路由、__binary__ 修正、import 约定已作为附录 A–D 追加到 v2.0 正文；原章节编号不变，开头加修订说明。v2.0 正文 SHA256 1fe0b8cb1f50e76bf8129bb4b16be5c9cc87f935ed517208b2b3b56ab82ec3f6 → 123d5ce23d69858894724022a8b8486cb9a22278b1e0da59519a0d1cdb9e631f。备份 data/backup/round57_whitepaper/whitepaper_v2.0.bak。 | done | 57 | 2026-10-29T20:17:07+03:00 | data/backup/round57_whitepaper/whitepaper_v2.0.bak |
| tests/smoke_plugins.py::PLUGINS_WITH_BACKEND | round 56 差异解释修正 | round 56 称 PLUGINS_WITH_BACKEND 比 EXPECTED_PLUGIN_IDS 少 webchat/cobuild/tts，实际原 16 项是“有卡片+backend”，缺的是 backend-only 3 个；而 EXPECTED_PLUGIN_IDS 19 项比它多 expdata/netexp/sim（有卡片但无 backend）。round 57 已按“所有 backend”动态化为 19。 | done | 57 | 2026-10-29T20:17:07+03:00 |  |
| tests/smoke_plugins.py::PLUGINS_WITH_BACKEND | 动态化完成（所有 backend 插件） | 原手写 16 项是“有卡片+backend”；实际语义为“所有 backend 插件”，动态化后 19 项，补上 webchat/cobuild/tts。每个插件有 backend 文件 + import 两条断言，故断言数 175→181（+6）。smoke_plugins 181/181 PASS。 | done | 57 | 2026-10-29T20:17:07+03:00 | data/backup/round57_smoke_plugins/smoke_plugins.py.bak |
| plugins/pdf/backend.py::__binary__ | 格式与宿主一致（round 57 核实） | pdf 使用 {__binary__: True, body, mime, filename, headers}，与宿主解析一致。smoke_pdf 17/17 PASS，并覆盖 binary 200/Content-Type/附件名/body 一致。 | done | 57 | 2026-10-29T20:17:07+03:00 |  |
| docs/plugin-development-whitepaper-v2.1-draft.md | 新建·v2.1 修订草案（待用户审阅） | round 56 汇总 round 37–55 发现的 v2.0 空白与偏差：backend-only 插件规范、根路由约定、__binary__ 格式修正、插件 import 约定。草案未生效，v2.0 正文不改。待用户审阅后决定合并方式（直接改 v2.0 或升级为 v2.1）。 | done | 56 | 2026-10-29T20:02:04+03:00 |  |
| tests/smoke_plugins.py::PLUGINS_WITH_BACKEND | 调查完成·可动态化，留 round 57 | 16 项；语义为“有卡片且有 backend 的插件”，即 manifest.backend 非空且 entries 非空。与 BACKEND_ONLY_PLUGINS 互补（backend-only 3 个）。可从 manifest 推导；被 backend 字段校验、backend import 循环、清单字段校验引用。若动态化会新增 3 个 backend import 检查，断言数会从 175 增加，需单独评估；本轮不改。 | reviewed | 56 | 2026-10-29T20:02:04+03:00 |  |
| tests/smoke_plugins.py::EXPECTED_PLUGIN_IDS | 19 vs 16 矛盾解释：16 是另一个字典 | EXPECTED_PLUGIN_IDS 动态化后仍为 19（有卡片的插件，不含 webchat/cobuild/tts 三个 backend-only）。16 是 PLUGINS_WITH_BACKEND 的规模，语义为“有卡片且有 backend 的插件”；两者不是同一集合，不存在数字矛盾。 | done | 56 | 2026-10-29T20:02:04+03:00 |  |
| tests/smoke_plugins.py::残留手写字典 | round 55 动态化等价性确认 | round 56 核实：EXPECTED_PLUGIN_IDS 19、EXPECTED_ENTRY_IDS 21、V2_DB_SPECS 13，与 round 54 手写值完全一致。动态化是纯等价替换，无静默增减。 | done | 56 | 2026-10-29T20:02:04+03:00 |  |
| tests/smoke_plugins.py::残留手写字典 | 动态化完成（EXPECTED_PLUGIN_IDS / EXPECTED_ENTRY_IDS / V2_DB_SPECS） | round 55 调查确认三者均可从 manifest 推导：EXPECTED_PLUGIN_IDS = entries 非空的 pid；EXPECTED_ENTRY_IDS = V2_ENTRY_IDS 扁平化后排序；V2_DB_SPECS = manifest.db 非空项。已改为动态；断言数 175 → 175 不变。备份 data/backup/round55_smoke_plugins/smoke_plugins.py.bak。 | done | 55 | 2026-10-29T19:56:36+03:00 | data/backup/round55_smoke_plugins/smoke_plugins.py.bak |
| ui/web/static/app.js::rtDlSaveGroupConfig | 写触发场景确认 | 调用点：rtDlPickDirectory() 在 showDirectoryPicker 返回并保存 handle 后调用（用户点击选择目录触发）；rtDlResetDirectory() 在用户重置分组时调用。download_groups 留在宿主，此记录供未来排查。 | reviewed | 55 | 2026-10-29T19:56:36+03:00 |  |
| download_groups | 调查完成·待建 downloads 插件 | 调用方：ui/web/server.py _download_groups() 规范化/合并（392-406、434、457-460），app.js rtDlGroupCfg/rtDlSaveGroupConfig（116、174-176），tests/smoke_reader_range.py 5 条 API 断言与 smoke_web 1 条 host settings 断言。配置仅 {enabled, dir_name}；dir_name 是浏览器 handle.name 的显示名，真实目录 handle 存 IndexedDB，服务端不写文件，无路径穿越。当前 data/settings.json 仅 promptgen 一组。建议 backend-only plugins/downloads/，schema/db/style/data_dirs 均无；保留 /api/settings 宿主转调（方案 A），数据迁 data/plugins/downloads/settings.json，旧键保留一轮。 | reviewed | 54 | 2026-10-29T19:48:41+03:00 |  |
| plugins/book_reader/schema.sql::visual_settings | DDL 去重后明确依赖 pixel_art 模块 | visual_settings 表由 pixel_art 建；book_reader 通过 pixel_art.service 间接读写。若用户关闭 pixel_art 模块但开启 book_reader，book_reader 的视觉设置 API 会 503。这是模块化的预期行为，记录供排查。 | done | 54 | 2026-10-29T19:48:41+03:00 |  |
| tests/smoke_plugins.py::_load_manifests | round 52 边界测试结论修正 | round 52 报告称临时插件 testbackend 存在时 175/175 PASS、动态逻辑有效；round 53 用 _edge_test 复现得到 174/175，FAIL 来自 fixture 非法（缺 icon/version/provides/consumes、id 下划线），输出含 _edge_test 证明扫描正常。round 52 的 175/175 可能是 fixture 未被扫到或报告简化，以 round 53 复核为准：动态扫描有效，但边界测试需用合法 fixture 才能得到 176+。 | done | 54 | 2026-10-29T19:48:41+03:00 |  |
| tests/smoke_plugin_decoupling.py::free_port | TOCTOU 修复（启动重试） | 原 free_port() 分配端口后立即关闭，存在被抢占窗口。Server.start() 改为健康检查失败时换新端口重试 3 次、间隔 0.5 秒；3 次运行 452/452 PASS。 | done | 53 | 2026-10-29T19:44:06+03:00 | data/backup/round53_edge/smoke_plugin_decoupling.py.bak |
| visual_settings 表 DDL | 去重（保留 pixel_art，删除 book_reader） | 两份 DDL 列定义/default 完全相同，均为 CREATE TABLE IF NOT EXISTS；book_reader 的 visual-settings API 通过 plugins.pixel_art.service 间接读写，pixel_art 是主。已删除 book_reader/schema.sql 中该表定义，保留 pixel_art 一份。临时库 sqlite_master 仅 visual_settings 一条；4 个 smoke PASS。 | done | 53 | 2026-10-29T19:44:06+03:00 | data/backup/round53_schema/book_reader_schema.sql |
| tests/smoke_plugins.py::_load_manifests | 边界复核：动态推导已识别临时插件，无漏扫 | _edge_test 无 BOM 时 RESULT=174/175，输出含 _edge_test，manifest 结构 FAIL 来自临时 fixture 缺 icon/version/provides/consumes 且 id 非法；插件目录数从 22→23 通过，v2 清单含 _edge_test。断言总数固定为 175（聚合断言，不随插件数增加），所以不是 176；未发现漏扫，未改扫描逻辑。清理后 175/175。 | done | 53 | 2026-10-29T19:44:06+03:00 |  |
| tests/smoke_plugins.py | 动态化：7 个硬编码字典改为从 manifest 推导 | round 37–51 共 8 次同类硬编码同步；V2_ENTRY_IDS 出现两份重复定义。已改为从 plugins/*/manifest.json 与文件系统推导；APP_JS_NON_PLUGIN_IDS 保留手写。动态化前后断言数一致（175 → 175），边界临时插件 175/175 PASS。备份 data/backup/round52_smoke_plugins/smoke_plugins.py.bak。 | done | 52 | 2026-10-29T19:30:20+03:00 | data/backup/round52_smoke_plugins/smoke_plugins.py.bak |
| tests/smoke_plugins.py::V2_ENTRY_IDS | 删除重复定义（两份→一份） | round 52 确认 V2_ENTRY_IDS 原先在 88、99 行重复定义，后一份覆盖前一份；已合并为动态推导的单一字典。 | done | 52 | 2026-10-29T19:30:20+03:00 |  |
| POST /api/voice-cache/clear → POST /api/plugin/tts/clear-cache | 接口路径变更（返回格式不变） | 宿主 /api/plugin/<id>/* 不接受空子路径；clear-cache 返回 count/mb 字段与原路由一致，smoke_web "voice cache clear" 断言 PASS。 | done | 52 | 2026-10-29T19:23:49+03:00 |  |
| plugins/tts/backend.py::__binary__ | 格式与宿主一致 | round 52 核实：宿主解析 __binary__ 的格式是 __binary__ is True + body(bytes) + mime + headers；round 51 的返回格式与之一致。白皮书的 __binary__=bytes 是简化描述，以宿主实现为准。 | done | 52 | 2026-10-29T19:23:49+03:00 |  |
| tests/smoke_plugins.py | 第 8 次同步：tts backend-only | BACKEND_ONLY_PLUGINS、EXPECTED_V2_PLUGINS、V2_* 字典加入 tts；smoke_plugins 175/175 PASS。 | done | 51 | 2026-10-29T19:21:01+03:00 |  |
| tests/smoke_web.py | TTS 断言路径同步 | 两条 TTS 相关断言（voice cache clear、tts audio）改插件路径，语义不变；tts audio 仍为 1 条 502。 | done | 51 | 2026-10-29T19:21:01+03:00 |  |
| ui/web/static/app.js::TTS | TTS/缓存清理路径同步 | /api/tts?text= → /api/plugin/tts/speak?text=；/api/voice-cache/clear → /api/plugin/tts/clear-cache。 | done | 51 | 2026-10-29T19:21:01+03:00 |  |
| ui/web/server.py::/api/tts | 旧路由移除（随 tts 下沉） | 删除 /api/tts 与 /api/voice-cache/clear 分支及 _handle_tts；改由 /api/plugin/tts/speak 与 /clear-cache。 | done | 51 | 2026-10-29T19:21:01+03:00 |  |
| plugins/tts/ | 新建 backend-only 插件 | manifest.entries=[]、provides=["tts"]；GET /speak 返回 audio/mpeg，POST /clear-cache 承接原缓存清理。 | done | 51 | 2026-10-29T19:21:01+03:00 |  |
| modules/tts.py | 下沉至 plugins/tts/tts.py | edge-tts 语音合成业务，被 app.js / russian / book_reader 共用；新建 backend-only 插件承接（provides: tts）。音频缓存路径不变；edge-tts 保持子进程调用。 | done | 51 | 2026-10-29T19:21:01+03:00 | data/backup/round51_tts/tts.py |
| tests/smoke_plugins.py::entries-empty | round 49 隐性放宽，round 50 收窄 | round 49 为支持 webchat backend-only，把空 entries 校验改为 `not data.get('backend')`，实际是全局放行；round 50 复核发现并收窄为仅 BACKEND_ONLY_PLUGINS。round 49 报告称‘未放宽业务断言’不准确，以 round 50 修正为准。 | done | 51 | 2026-10-29T19:15:16+03:00 |  |
| GET /api/cobuild → GET /api/plugin/cobuild/data | 接口语义变更（空子路径限制） | 宿主 /api/plugin/<id>/* 分发不接受空子路径，原 GET /api/cobuild 映射为 GET /api/plugin/cobuild/data。app.js 与 smoke_web 已同步；外部调用方若存在会 404。同类风险：未来任何有根路径 GET 的模块下沉时都要改名。 | done | 51 | 2026-10-29T19:15:16+03:00 |  |
| tests/smoke_web.py | cobuild 断言路径同步 | 5 条 cobuild 断言路径改为 /api/plugin/cobuild/*，断言语义不变；smoke_web 74/75（TTS 502）。 | done | 50 | 2026-10-29T19:12:29+03:00 |  |
| tests/smoke_plugins.py | 第 7 次同步：cobuild backend-only | BACKEND_ONLY_PLUGINS 加 cobuild，EXPECTED_V2_PLUGINS/V2_EXPECTED_FILES 等同步；smoke_plugins 175/175 PASS。 | done | 50 | 2026-10-29T19:12:29+03:00 |  |
| ui/web/server.py::/api/cobuild* | 旧路由移除（随 cobuild 下沉） | 删除 /api/cobuild、/api/cobuild/checkin、/api/cobuild/void 三条分支；前端改 /api/plugin/cobuild/*。 | done | 50 | 2026-10-29T19:12:29+03:00 |  |
| plugins/cobuild/ | 新建 backend-only 插件 | manifest.entries=[]、backend=backend.py；不渲染卡片。路由 data/checkin/void；data_dirs=[]。 | done | 50 | 2026-10-29T19:12:29+03:00 |  |
| modules/cobuild.py | 下沉至 plugins/cobuild/cobuild.py | 多 AI 共建打卡业务，独立域；新建 backend-only 插件承接。data/ai_cobuild.json 与 docs/多AI共建日志.md 路径不变，SHA256 前后一致。 | done | 50 | 2026-10-29T19:12:29+03:00 | data/backup/round50_cobuild/cobuild.py |
| tests/smoke_plugins.py | backend-only 检查收窄（round 49 复核） | 发现 round 49 的空 entries 分支只检查 manifest.backend，任何有 backend 的 v2 插件都可通过，属于全局放宽。已改为仅 BACKEND_ONLY_PLUGINS 内且声明 backend 时放行；webchat 仍通过。 | done | 50 | 2026-10-29T19:06:56+03:00 |  |
| webchat_profile/ | round 49 未动，但缺改动前基线 | round 49 下沉 web_chat 时未采集 profile 文件数基线；当前 658 文件/68 目录。status() 只检查路径存在，未启动 Playwright，确认无写操作。建议后续涉及 profile 的操作在阶段 0 先采基线。 | reviewed | 50 | 2026-10-29T19:06:56+03:00 |  |
| tests/smoke_plugins.py | 支持 backend-only 插件校验 | 新增 webchat 期望文件、entries=[] 例外（仅 manifest.backend 存在时）、active/styled/清单字段跳过卡片校验；插件数 19→20（目录），卡片仍 19/21。 | done | 49 | 2026-10-29T19:03:27+03:00 |  |
| ui/web/static/app.js::FQ_AI_POST | 中断列表路径同步（/api/plugin/webchat/*） | FQ_AI_POST 与 restart fetch 全部改为插件路径；ai/finance/shared webchat 同步。 | done | 49 | 2026-10-29T19:03:27+03:00 |  |
| ui/web/server.py::/api/webchat/* | 旧路由移除（随 web_chat 下沉） | 删除 8 条 /api/webchat/* 分支；旧路径走通用 404。 | done | 49 | 2026-10-29T19:03:27+03:00 |  |
| plugins/webchat/ | 新建 backend-only 插件 | manifest.entries=[]、backend=backend.py；不渲染卡片，/api/plugin/webchat/* 由后端加载。data_dirs=[]，不创建数据目录。 | done | 49 | 2026-10-29T19:03:27+03:00 |  |
| modules/web_chat.py | 下沉至 plugins/webchat/web_chat.py | Playwright 网页会话业务，ai/finance/app.js 三处共享；新建 backend-only 插件承接。webchat_profile/ 与 data/webchat_sessions.json 路径不变；_PROFILE_DIR 由相对路径改为 config.BASE_DIR。 | done | 49 | 2026-10-29T19:03:27+03:00 | data/backup/round49_webchat/web_chat.py |
| ui/web/server.py::_plugin_list | backend-only 插件已支持（前端跳过，backend 正常加载） | round 49 确认：_plugin_backend() 只读 manifest.backend，不读 entries；entries=[] 的插件不进前端卡片列表，但 /api/plugin/webchat/* 正常分发。无需改 server.py。smoke_plugins 已扩展 backend-only 校验。 | done | 49 | 2026-10-29T19:03:27+03:00 |  |
| tests/smoke_plugins.py | 期望清单同步（ai ai_bridge） | round 48 下沉 ai_bridge 后，ai V2_EXPECTED_FILES 增加 ai_bridge.py；重跑 smoke_plugins 175/175 PASS。 | done | 48 | 2026-10-29T18:48:33+03:00 |  |
| plugins/finance/feature_finance.js | 跨插件路由：/api/ai/* 改 /api/plugin/ai/* | finance 的 AI 归因依赖 ai 插件；改为插件间 HTTP 调用，非直接 import。若 ai 插件下线，finance 的 AI 归因会失效，需在 finance review 标注。 | done | 48 | 2026-10-29T18:48:33+03:00 |  |
| ui/web/server.py::/api/ai/* | 旧路由移除（随 ai_bridge 下沉） | 删除 GET/POST /api/ai/keys 与 POST /api/ai/chat 分支；旧路径走通用 404。 | done | 48 | 2026-10-29T18:48:33+03:00 |  |
| modules/ai_bridge.py | 下沉至 plugins/ai/ai_bridge.py | AI 密钥/对话业务，ai 与 finance 共用；ai 插件是自然 owner。data/ai_keys.json 路径不变。旧 /api/ai/* 删除，新增 /api/plugin/ai/*；finance 与 ai 前端同步。 | done | 48 | 2026-10-29T18:48:33+03:00 | data/backup/round48_ai_bridge/ai_bridge.py |
| plugins/aidebug/feature.js | 豆包监听面板下线 | 删除豆包面板与 dbb-* 事件/轮询代码，文件 200 → 126 行（净删 74 行）；保留“豆包监听已下线”占位；外部接口调试器不受影响。 | done | 47 | 2026-10-29T18:36:16+03:00 |  |
| ui/web/server.py::/api/doubao/* | 旧路由移除（随 doubao_watch 归档） | 删除 /api/doubao/probe、status、history_reset、watch 四条分支；旧路径走通用 404。 | done | 47 | 2026-10-29T18:36:16+03:00 |  |
| modules/doubao_watch.py | 归档（用户决定下线豆包 UIA 监听） | 依赖 UIAutomation 与豆包客户端窗口结构，脆弱性高；数据文件 round 33 已归档；aidebug 仅附带入口。归档至 归档/modules/doubao_watch.py。 | done | 47 | 2026-10-29T18:36:16+03:00 | data/backup/round47_doubao/doubao_watch.py |
| tests/smoke_plugins.py | 期望清单同步（finance crawler） | finance V2_EXPECTED_FILES 增加 crawler.py；smoke_plugins 175/175 PASS。 | done | 46 | 2026-10-29T18:22:23+03:00 |  |
| ui/web/server.py::/api/crawl | 旧路由移除（改插件路由） | 删除 /api/crawl 分支；finance 前端改 /api/plugin/finance/crawl，旧路径走通用 404。 | done | 46 | 2026-10-29T18:22:23+03:00 |  |
| modules/crawler.py | 下沉至 plugins/finance/crawler.py | 仅 finance 调用；旧 /api/crawl 删除，新增 /api/plugin/finance/crawl；finance 前端与 app.js 中断列表同步。备份 data/backup/round46_crawler/。 | done | 46 | 2026-10-29T18:22:23+03:00 | data/backup/round46_crawler/crawler.py |
| tests/smoke_plugins.py | 期望清单同步（finance fund_nav） | round 45 下沉 fund_nav 后，finance V2_EXPECTED_FILES 增加 fund_nav.py；重跑 smoke_plugins 175/175 PASS。 | done | 45 | 2026-10-29T18:07:19+03:00 |  |
| ui/web/server.py::/api/fund/* | 旧路由移除（改插件路由） | 删除 server.py 的 /api/fund/list 与 /api/fund/nav 分支；finance 前端改 /api/plugin/finance/fund/list、/nav。 | done | 45 | 2026-10-29T18:07:19+03:00 |  |
| modules/fund_nav.py | 下沉至 plugins/finance/fund_nav.py | 旧 /api/fund/* 仍存在并服务 finance 前端；已移至 plugins/finance/fund_nav.py，finance backend 新增 fund/list、fund/nav 子路径，前端改 /api/plugin/finance/fund/*，宿主旧路由移除。smoke_finance 34/34、smoke_web 74/75（TTS）、decoupling 452/452 PASS。 | done | 45 | 2026-10-29T18:07:19+03:00 | data/backup/round45_fund_nav/fund_nav.py |
| modules/web_chat.py | 调查完成·建议新建 plugins/webchat/ | plugins/ai 与 plugins/finance 共用 /api/webchat/*；ui/web/static/app.js 与 features/webchat.js 也依赖，多个插件共享，不能只并入 ai。 需要的改动：新建 plugins/webchat/manifest.json + backend.py + 可选 entry；webchat_profile/ 与会话 JSON 保持在 data，迁移后由插件管理。 反向依赖：frontend: ai/finance/app shared. | reviewed | 45 | 2026-10-29T18:07:19+03:00 |  |
| modules/doubao_watch.py | 调查完成·建议并入 plugins/aidebug/ | 仅 plugins/aidebug/feature.js 调用 /api/doubao/*；是豆包 UIA 调试/监听业务，aidebug 已有 backend.py。 需要的改动：aidebug 已有 backend.py，新增 doubao 子路径；UIAutomation 保持可选导入，无 db/entry。 反向依赖：frontend: aidebug. | reviewed | 45 | 2026-10-29T18:07:19+03:00 |  |
| modules/crawler.py | 调查完成·建议并入 plugins/finance/ | 仅 plugins/finance/feature_finance.js 调用 /api/crawl；属于理财抓取业务，不是共享基础设施。 需要的改动：finance 已有 backend.py，新增 crawl 子路径；无 db/entry 改动。 反向依赖：frontend: finance. | reviewed | 45 | 2026-10-29T18:07:19+03:00 |  |
| modules/ai_bridge.py | 调查完成·建议并入 plugins/ai/ | plugins/ai 与 plugins/finance 前端均调用 /api/ai/keys、/api/ai/chat；AI 业务归 ai 插件，finance 作为跨插件消费者。 需要的改动：plugins/ai 已有 backend.py，新增 ai/keys、ai/chat 子路径；无需新 db/entry。 反向依赖：frontend: ai/finance. | reviewed | 45 | 2026-10-29T18:07:19+03:00 |  |
| modules/settings_store.py::MODULES | 收缩完成 | MODULES 删除 russian/pixel，移除 pixel_art→pixel 特判；静态验证 russian/pixel 仍默认 True、pm True。收缩后 smoke_startup_once 33/33、smoke_plugins 175/175、smoke_plugin_module_off 10/10、smoke_plugin_data_dirs 13/13；after_modules 5 次 decoupling 全部 452/452；全量 13 回归仅 TTS 502。 | done | 44 | 2026-10-29T17:44:21+03:00 | data/backup/round44_modules/settings_store.py |
| tests/smoke_plugin_decoupling.py | round 44 起点基线 | data/backup/round44_decoupling/start_run_01.txt：452/452 PASS。 | done | 44 | 2026-10-29T17:44:21+03:00 |  |
| tests/smoke_plugin_decoupling.py::log_errors | 注入验证通过·过滤条件安全 | 临时在 plugins/bg_library/backend.py 的 handle() 首行注入 raise RuntimeError("round44 injected error")，decoupling 检出并 FAIL（bg_library 阶段1 API 500、日志出现 Traceback / RuntimeError）。恢复后 SHA256 与备份完全一致（5716d9d6...），恢复后 decoupling 452/452 PASS。过滤条件只忽略 ConnectionResetError/WinError 10054 块，未吞真错误。 | done | 44 | 2026-10-29T17:44:21+03:00 |  |
| data/backup/round43_decoupling/ | 保留为 decoupling 长期基线目录 | 保存 10 次修前日志 run_01..10 与 10 次修后日志 after_fix_run_01..10，后续复现/比较不覆盖历史文件。 | done | 43 | 2026-10-29T17:24:57+03:00 |  |
| tests/smoke_plugin_decoupling.py | 稳定性修复（连接关闭 + 窄化 socket 日志过滤） | 10 次基线 1/10 FAIL（run_08，451/452）：bg_library 阶段2 日志出现 http.server 的 ConnectionResetError/WinError 10054 客户端断连 traceback。该异常不是业务错误，但被 log_errors 误判。仅改测试：HTTP 请求加 Connection: close；log_errors 仅忽略包含 ConnectionResetError/WinError 10054 的请求处理断连块；未改任何业务断言，仍为 452 条。修后 after_fix_run_01..10 全部 452/452 PASS。 | done | 43 | 2026-10-29T17:24:57+03:00 |  |
| modules/settings_store.py::MODULES | 调查完成·暂缓收缩（decoupling 不稳定） | MODULES/module_enabled 无插件/测试调用；db.connection 使用自身 _module_enabled 直接读 modules.enabled，russian/pixel 可移除，pixel_art→pixel 特判无调用方。但执行收缩后 smoke_plugin_decoupling 首次 451/452，重跑 452/452；按铁律已从 data/backup/round42_modules/settings_store.py 回滚，MODULES 仍保留 russian/pixel 与特判。需先稳定 decoupling 再收缩。 | reviewed | 42 | 2026-10-29T16:52:43+03:00 |  |
| docs/appendix/file_navigation.json::round41-stage4 | 报告表述修正（round 41） | round 41 报告阶段 4 段落误写“旧宿主业务键已删除”；实际 data/backup/round41_settings/settings.json 与 settings.after_split.json SHA256 完全相同（cbc616fe...），证明阶段 4 未删键，阶段 6 才删。流程合规，仅报告表述错位，状态不回滚。 | done | 42 | 2026-10-29T16:52:43+03:00 |  |
| tests/smoke_plugin_decoupling.py | round 42 基线通过 | 完整输出已保存 data/backup/round42_decoupling/baseline.txt；RESULT 452/452 PASS，耗时约 80.3 秒。 | done | 42 | 2026-10-29T16:52:43+03:00 |  |
| data/settings.json | 拆分完成（宿主仅保留 download_groups/modules） | data/plugins/russian/settings.json 持有 ru_family/ru_size/new_quota/review_quota；data/plugins/model_usage/settings.json 持有 model_pricing。宿主 settings.json 仅保留 download_groups 与 modules.enabled，旧业务键已删除；迁移脚本保留旧键读取兼容。 | done | 41 | 2026-10-29T13:36:31+03:00 |  |
| modules/settings_store.py | 路径参数化，旧函数保留 | 新增 DEFAULT_SETTINGS_PATH、plugin_settings_path、read_at/write_at/update_at；旧 path/read/write/update 转发到默认宿主路径；modules_enabled/module_enabled/MODULES 本轮未改。 | done | 41 | 2026-10-29T13:36:31+03:00 | data/backup/round41_settings/settings_store.py |
| ui/web/server.py::api_settings_save | 方案 A：new_quota 转调 russian 插件文件 + config 顺序修正 | new_quota/review_quota 从/向 data/plugins/russian/settings.json 读写；download_groups 仍写宿主 settings.json；先写 russian 插件文件、再写宿主文件、两者成功后更新 config，失败回滚插件值并保持 config 不变。 | done | 41 | 2026-10-29T13:36:31+03:00 |  |
| plugins/russian/backend.py | new_quota 写 plugin_settings_path("russian") | russian 设置读写改用 settings_store.read_at/write_at/update_at(plugin_settings_path("russian"))；new_quota/review_quota 写成功后才更新 config。 | done | 41 | 2026-10-29T13:36:31+03:00 | data/backup/round41_settings/russian_backend.py.bak |
| plugins/model_usage/service.py | model_pricing 写插件 settings | pricing_config/save_pricing 改用 data/plugins/model_usage/settings.json；不再读写宿主 settings.json。 | done | 41 | 2026-10-29T13:36:31+03:00 |  |
| tools/migrate_settings_split.py | 一次性拆分迁移脚本 | 将 ru_* / new_quota / review_quota 合并到 russian 插件 settings，model_pricing 合并到 model_usage；先读后合并、已有插件键优先、不删宿主旧键；运行两遍幂等。 | done | 41 | 2026-10-29T13:36:31+03:00 |  |
| ui/web/server.py::config-update-order | 已修复（round 41 阶段 3） | round 40 复查发现 config.DAILY_NEW_QUOTA 在写文件前更新；round 41 改为 russian 插件文件与宿主文件均写成功后才更新 config，失败不改 config。 | done | 41 | 2026-10-29T13:36:31+03:00 |  |
| tests/ | 长期提醒：每轮下沉/改 settings/改 API 后跑全量 13 个 smoke | round 37 漏跑 smoke_plugins、round 37/38 漏跑 smoke_reader_range，两次都是同因：只跑指定 smoke。以后每轮下沉或改 settings/API 后，按端口分组跑全量 13 个测试（8897/8898/8899 串行），不依赖单测试 PASS 就下结论。 | done | 40 | 2026-10-29T13:15:57+03:00 |  |
| tests/smoke_reader_range.py::static-wiring | 基线静态路径同步 | 修复 new_quota 后测试继续暴露旧静态路径 /features/promptgen.js、/features/book_reader.js 已 404；实际文件已迁到 /plugins/promptgen/feature.js 与 /plugins/book_reader/feature.js。仅更新测试中的 5 个静态路径检查，未改业务断言；smoke_reader_range 25/25 PASS。 | done | 40 | 2026-10-29T13:15:57+03:00 |  |
| ui/web/server.py::api_settings_save | 基线阻塞修复 | 调查确认 api_settings_save 原先只写/回显 download_groups，完全忽略 POST 的 new_quota；而 smoke_reader_range 明确要求 new_quota=7 写入 settings.json、在响应中回显并在后续仅保存 download_groups 时保留。API 契约应为“保存并回显 new_quota 与 download_groups 共存”。已让 api_settings_save 校验并写入 new_quota，同步 config.DAILY_NEW_QUOTA；api_settings 在存在时回显 new_quota。smoke_reader_range 25/25 PASS。 | done | 40 | 2026-10-29T13:15:57+03:00 |  |
| tests/smoke_web.py::/api/tts | 已知环境问题·不阻断 | edge-tts 外部网络，74/75 唯一 FAIL，非本轮引入。 | done | 39 | 2026-10-29T13:10:19+03:00 |  |
| tests/smoke_plugins.py | 期望清单同步（round 37 遗漏） | round 37 下沉 model_usage 未跑 smoke_plugins，round 38 补 154/159 行期望项，175/175 PASS；以后每轮下沉必跑 smoke_plugins。 | done | 39 | 2026-10-29T13:10:19+03:00 |  |
| plugins/book_reader/book_reader.py | import 修正（随 pixel_art 下沉） | 原 from modules import pixel_art（行 1014、1017）改为 from plugins.pixel_art import service。插件间依赖（方向④），短期接受直接 import + 标注；长期可改 GET /api/plugin/pixel_art/assets。 | done | 38 | 2026-10-29T01:03:25+03:00 |  |
| modules/visual_settings.py | 下沉至 plugins/pixel_art/visual_settings.py | round 33 判业务残留（含 visual_settings 表 SQL），round 36 确认唯一引用方为 modules/pixel_art.py。随 pixel_art 一起下沉，service.py 改 from . import visual_settings。原文件删除，备份 data/backup/round38_pixel_art/visual_settings.py。表 DDL 重复问题另记 pending。 | done | 38 | 2026-10-29T01:03:25+03:00 | data/backup/round38_pixel_art/visual_settings.py |
| modules/pixel_art.py | 下沉至 plugins/pixel_art/service.py | 方向③违规修复：原文件 import plugins.pixel_art.repo。已移至 service.py，内部 import 改同包；backend.py 改调 service；book_reader.py 的 from modules import pixel_art 改为 from plugins.pixel_art import service。原文件删除，备份 data/backup/round38_pixel_art/pixel_art.py。 | done | 38 | 2026-10-29T01:03:25+03:00 | data/backup/round38_pixel_art/pixel_art.py |
| plugins/*/backend.py | import 约定（round 37 发现） | 宿主按文件路径加载 backend.py，其 name 非包名，故 backend.py 内部 import 同插件模块必须用 from plugins.<id> import <module>，不能用 from . import <module>（会报 attempted relative import with no known parent package）。被 backend.py 以包内模块身份加载的 service.py 等，可用 from . import <module>。round 37 的 plugins/model_usage/backend.py 已按此约定修正。 | done | 38 | 2026-10-29T01:03:25+03:00 |  |
| plugins/finance/fixtures/rt_fin.json | 加入 file_preview 排除 | round 36 发现 file_preview 扫描 179 与 manifest 178 差额即此文件；含财务数据，manifest 早已排除但 file_preview 未覆盖。已在 EXCLUDE_FILE_GLOBS 加入 rt_fin.json，扫描回 178。 | done | 37 | 2026-10-29T00:52:34+03:00 |  |
| modules/model_usage.py | 下沉至 plugins/model_usage/service.py | 方向③违规修复：原 modules/model_usage.py 反向 import plugins.model_usage.repo。已移至 plugins/model_usage/service.py，内部 import 改为同包；backend.py 改调 service。原文件删除，备份 data/backup/round37_model_usage/model_usage.py。 | done | 37 | 2026-10-29T00:52:34+03:00 | data/backup/round37_model_usage/model_usage.py |
| modules/web_chat.py | 调查完成·保留 | server.py 的 /api/webchat/* 使用；Playwright 延迟导入，读写 webchat_sessions.json。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/visual_settings.py | 调查完成·建议下沉到 plugins/pixel_art/（待裁决） | modules/pixel_art.py 直接 import；plugin book_reader 经 pixel_art 间接使用；文件包含 visual_settings 表 SELECT/INSERT/UPDATE SQL。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/tts.py | 调查完成·归属待裁决 | server.py 的 /api/tts 使用；调用 edge-tts/subprocess，无 SQL/JSON 状态；学习/阅读链路依赖 TTS HTTP。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/settings_store.py | 调查完成·保留 | server.py、modules/model_usage.py、modules/web_chat.py、plugins/russian/backend.py 使用；仅 data/settings.json 共享读写。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/pixel_art.py | 调查完成·建议下沉到 plugins/pixel_art/ | plugins/pixel_art/backend.py 与 plugins/book_reader/book_reader.py 反向 import；模块 import plugins.pixel_art.repo 与 modules.visual_settings；含作品/资产业务逻辑。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/model_usage.py | 调查完成·建议下沉到 plugins/model_usage/ | plugins/model_usage/backend.py 反向 import；模块本身 import plugins.model_usage.repo 与 modules.settings_store；含价目/统计业务逻辑。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/fund_nav.py | 调查完成·建议下沉到 plugins/finance/ | server.py 的 /api/fund/* 使用；读写基金缓存 JSON，无 SQL；finance 已有 backend.py 可承接。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/doubao_watch.py | 调查完成·保留 | server.py 的 /api/doubao/* 使用；UIAutomation 为 try/except 可选导入（模块加载时），读写 doubao 归档/历史 JSON。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/crawler.py | 调查完成·保留 | server.py 的 /api/crawl 使用；仅 urllib 抓取，无 SQL/JSON 状态。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/cobuild.py | 调查完成·建议新建插件（待裁决） | server.py 的 /api/cobuild/* 使用；读写 data/ai_cobuild.json 与 docs/多AI共建日志.md。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/ai_bridge.py | 调查完成·保留 | 宿主 AI 桥接：server.py 的 /api/ai/keys 与 /api/ai/chat 使用；仅访问敏感配置与外部 API。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| modules/__init__.py | 调查完成·保留 | 宿主模块包标记；无业务/SQL/运行期引用。 | reviewed | 36 | 2026-10-29T00:31:40+03:00 |  |
| tests/smoke_file_preview.py | 回归通过（round 35 排除规则修改后） | round 35 在 plugins/bg_library/file_preview.py 的 EXCLUDE_DIR_NAMES 加入“归档”；本轮 smoke_file_preview 17/17 PASS，确认排除列表变更未破坏扫描/DB 识别/规则 CRUD/越界拒绝。 | done | 36 | 2026-10-29T00:31:40+03:00 |  |
| 归档/ | 排除（file_preview 规则） | 用户决定归档目录不进 files_manifest；round 34 的“纳入文件预览”决定被推翻。已在 plugins/bg_library/file_preview.py 的 EXCLUDE_DIR_NAMES 加入“归档”，目录级生效，未来 modules/plugins/ui/db 归档后自动排除。manifest 从 202 回 178。 | done | 35 | 2026-10-29T00:28:35+03:00 |  |
| 归档/ | 归档进行中（data、docs 已完成；modules/plugins/ui/db 待归档） | 用户确认：归档/ 当前仅含 data/ 与 docs/ 两个子目录；modules/、plugins/、ui/、db/ 等尚未归档，是后续任务。本记录供后续轮次参考，避免误判归档为完整镜像。 | reviewed | 35 | 2026-10-29T00:28:35+03:00 |  |
| docs/appendix/files_manifest.json | 口径表述修正 | round 34 的“181 = 202 - 24 + 3”数学成立但语义易误读。round 35 排除归档后：主目录 manifest 条目 = 178；主目录实际文件 = 178 + 3（敏感：ai_keys.json、webchat_sessions.json、plugins/finance/fixtures/rt_fin.json）= 181。归档文件 24 个不计入 manifest。 | done | 35 | 2026-10-29T00:28:35+03:00 |  |
| 归档/ | 纳入文件预览（未命中排除规则） | file_preview 的 EXCLUDE_DIR_NAMES / EXCLUDE_REL_DIRS / EXCLUDE_FILE_GLOBS 不排除 归档/；已将 24 个非敏感归档文件加入 files_manifest，敏感归档文件不进入。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/appendix/files_manifest.json | 口径校验 | 主目录实际文件 N=181；manifest M=202（含 归档/ 下 24 个非敏感文件）；主目录排除敏感 K=3（data/ai_keys.json、data/webchat_sessions.json、plugins/finance/fixtures/rt_fin.json）；181 = 202 - 24 + 3。归档/data/doubao_archive.json 与归档/data/doubao_history.json 属于敏感文件，未进入 manifest。 | reviewed | 34 | 2026-10-29T00:23:13+03:00 |  |
| data/rivet.json | 归档（用户手动，覆盖第 21 轮“旧文件保留只读”） | 第 21 轮约定旧文件只读保留；用户本轮确认已手动归档到 归档/data/rivet.json，新文件 data/plugins/rivet/rivet.json 在位。本记录覆盖第 21 轮的“旧文件保留”语义，历史记录不修改。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| data/filejudge_keep.json | 归档（用户手动，迁移目标已知） | 第 22 轮已约定 data/plugins/filejudge/keep.json 为读写目标、旧文件只读；用户本轮确认旧文件已手动归档。round 33 记为“位置待确认”过保守，本轮回填迁移关系。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/poc-sim-card-2026-10-28.png | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/docs/poc-sim-card-2026-10-28.png）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/ui_favicon.png | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/docs/ui_favicon.png）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| data/doubao_history.json | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/data/doubao_history.json）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| data/doubao_archive.json | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/data/doubao_archive.json）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| data/filejudge_keep.json | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/data/filejudge_keep.json）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/plugin-standard-v1.md | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/docs/plugin-standard-v1.md）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/plugin-css-decision-2026-10-28.md | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/docs/plugin-css-decision-2026-10-28.md）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| docs/archive/download-export-feasibility-2026-10-24.md | 归档（用户手动，位置已确认） | 用户手动归档；`归档/` 按主目录相对结构存放，按相对路径匹配确认在位（归档/docs/archive/download-export-feasibility-2026-10-24.md）。本轮回填 new_path，未改动文件系统。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| tests/smoke_pdf.py | review 补充 | 白皮书第六节未点名 smoke_pdf.py；实际定位是 PDF 插件冒烟测试，不应强行归入解耦红线。 | reviewed | 33 | 2026-10-29T00:13:07+03:00 |  |
| modules/visual_settings.py | 归属审查 | 文件包含 visual_settings 表的 SELECT / INSERT / UPDATE SQL；被 modules/pixel_art.py 直接调用，book_reader/book_reader.py 通过 pixel_art 间接调用。虽为共享读写且无独立业务状态机，但按白皮书“SQL 集中与隔离”原则属于应下沉的业务 SQL 访问，不应长期留在宿主 modules/。 | reviewed | 33 | 2026-10-29T00:13:07+03:00 |  |
| docs/poc-sim-card-2026-10-28.png | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| docs/ui_favicon.png | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| data/doubao_history.json | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| data/doubao_archive.json | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| data/rivet.json | 归档（用户手动） | 用户手动归档移除；实际位置 data/plugins/rivet/rivet.json；本轮回填记录，未改动文件系统。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| data/filejudge_keep.json | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| docs/plugin-standard-v1.md | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| docs/plugin-css-decision-2026-10-28.md | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| docs/archive/download-export-feasibility-2026-10-24.md | 用户手动归档移除（位置待确认） | 用户确认手动归档移除；项目根内未找到同名文件，归档位置待用户补充。 | done | 33 | 2026-10-29T00:13:07+03:00 |  |
| tests/smoke_plugin_module_off.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| tests/smoke_plugin_decoupling.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| tests/smoke_plugin_data_dirs.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| tests/smoke_pdf.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/urlarch/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/urlarch/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/urlarch/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/urlarch/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/urlarch/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/sim/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/screeps/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/screeps/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/screeps/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/screeps/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/screeps/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/schedule/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/schedule/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/schedule/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/schedule/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/schedule/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/srs.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/seed.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/planner.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/models.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/importer.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/russian/__init__.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/rivet/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/promptgen/__init__.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/seed.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/pm_service.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/pm_repository.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/project_manager/__init__.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/pixel_art/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/pixel_art/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/pixel_art/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/pdf/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/netexp/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/model_usage/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/model_usage/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/model_usage/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/model_usage/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/finance/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/finance/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/finance/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/finance/migrate_localstorage.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/filejudge/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/expdata/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/reader_screen.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/migrate.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/bookmarks_repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/book_reader.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/book_reader/__init__.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/file_preview.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/bg_library.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/bg_library/__init__.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/aidebug/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/schema.sql | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/repo.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/plugin.css | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/manifest.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/feature.js | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| plugins/ai/backend.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| modules/visual_settings.py | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| docs/plugin-development-whitepaper.md | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| data/user_preferences.json | 审查完成·保留 | 第 32 轮按实际文件系统补齐登记；此前 manifest 未覆盖。 | reviewed | 32 | 2026-10-29T00:04:09+03:00 |  |
| docs/poc-sim-card-2026-10-28.png | 删除/迁出（回填） | 第 29–31 轮清理后实际已不存在；本轮回填 decided，未改动文件系统。 | done | 32 | 2026-10-29T00:04:09+03:00 |  |
| ui/web/static/data_export.html; tools/migrate_localstorage.py; tools/migrate_localstorage_batch2.py | 删除/移出宿主 | 数据安全迁移完成：一次性导出页从静态服务删除；两轮 localStorage 迁移脚本移入 data/backup/one_time_tools_20261028 并停止暴露；19 插件、0 内置，内容资产全部入库并带 raw_json/live_json。 | done | 31 | 2026-10-28T23:18:23+03:00 | data/backup/one_time_tools_20261028 |
| docs/archive/*.js, docs/archive/*.txt, data/bg_import/*（latest_update.json 除外）, data/finance_migration/, data/backup/旧备份 | 删除 | 终极清理：移除废弃归档脚本/日志、历史背景库中转包、财务迁移临时报告与旧备份；只保留 latest_update.json、host_zero_batch8 完整备份与有保留价值的归档 md。 | done | 30 | 2026-10-28T22:06:06+03:00 |  |
| core/ + db/schema/* | 删除 | 彻底清空宿主：core/repository.py 及其 model_usage/pixel_art/finance/visual_settings SQL 已分别迁入插件；db/schema/ 已无 DDL；全部 19 个插件、0 个内置工具。 | done | 29 | 2026-10-28T21:50:52+03:00 | data/backup/host_zero_batch8_20261028 |
| _t.audio | 删除 | 46 字节空 WAV 头测试残留，无代码/文档/清单引用；已先备份后删除。 | done | 11 | 2026-10-27T17:37:14+03:00 | data/backup/file_cleanup_2026-10-27 |
| read me.txt | 删除 | 早期项目说明草稿，与 README 高度重叠且含旧启动描述；已先备份后删除，README 为当前主说明。 | done | 11 | 2026-10-27T17:37:14+03:00 | data/backup/file_cleanup_2026-10-27 |
| DIFF_SUMMARY.txt | 删除 | 一次性变更摘要：project_manager.js 结果格式常量改为 notes→details→task_done 顺序，并更新 smoke_pm 断言；含 6 条人工验收，未完成项为无。摘要已归档至本清单 decided，记录保留；原件已备份后删除。 | done | 11 | 2026-10-27T17:37:14+03:00 | data/backup/file_cleanup_2026-10-27 |
| @AutomationLog.txt | 删除 | 第三方 UIAutomation 在后台线程初始化失败时反复写入的 CoInitialize / UIAutomationCore.dll 错误日志；项目代码无生成/读取引用，当前 Python 未安装 uiautomation，残留已备份后删除；未改 doubao_watch.py。 | done | 11 | 2026-10-27T17:37:14+03:00 | data/backup/file_cleanup_2026-10-27 |
| webchat_probe.py | 保留 | 最小 Playwright 验证脚本，file_notes 仍引用；无 tests/config/启动脚本/import 引用，非运行必需。本轮保留原位，不迁入 tools/；README 与 file_notes 标注“验证脚本，非运行必需”，若后续确需保留建议迁至 tools/。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| config.py | 保留 | 全局可调参数集中点，main.py、db/connection.py、core/*、ui/*、modules/* 均读取；保留原位不迁移，file_notes 完善结构化说明；配置项索引/指南需求记入 pending。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| main.py | 保留 | 三入口启动；bootstrap 执行 init_db 与首次种子；import modules.pm_templates 触发 seed 回调注册，db 不再反向 import modules。 | done | 25 | 2026-10-28T14:02:44+03:00 |  |
| README.md | 更新 schema 模块说明 | db/schema/*.sql + settings.modules.enabled 说明；默认全启用。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| tools/启动旅行之木.cmd | 保留 | Windows 便捷启动脚本，使用 %~dp0.. 与 PATH；保留并同步 file_notes。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| docs/appendix/file_navigation.json | 追加第 24 轮决定记录 | 记录 prompt_template 修复、pixel 下线、插件路由表与两个插件迁移；pixel 动画历史 decided 条目标记删除，历史审计材料引用保留。 | updated | 11 | 2026-10-27T17:37:14+03:00 |  |
| docs/appendix/file_navigation.md | 新建指南 | 由 docs/appendix/file_navigation.json 生成的只读摘要，标注“只读摘要，勿手改”；与 JSON 同步。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| docs/appendix/files_manifest.json | 重导出文件预览清单 | 按文件预览导出能力重生成；清除已删动画/Godot 文件条目并纳入新插件与路由表。 | updated | 11 | 2026-10-27T17:37:14+03:00 |  |
| core/__init__.py | 保留 | 包初始化文件，空实现避免副作用；无替代必要性，保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| core/models.py | 保留 | 领域数据结构 Item/ItemStat；被 repository、importer、seed、cli、gui、server 使用；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| core/planner.py | 保留 | 今日计划与配额分配；被 cli/gui/server 调用；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| core/repository.py | 模块关闭结构化错误 | SQL 经 _GuardedConnection；模块未建表时抛 ModuleDisabledError，由 server 统一转 503 module_disabled。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| core/srs.py | 保留 | SRS 档位升降与间隔计算；被 repository 调用；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| db/__init__.py | 保留 | 第三批 db 只读审查：包初始化空实现，避免导入副作用；六条 db 事实已写入 file_notes 与 pending。本轮零改动。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| db/connection.py | 模块化建表与缺表错误 | 按 modules.enabled 执行 db/schema/*.sql；get_conn 用 _GuardedConnection 将 no such table 转为 ModuleDisabledError；兼容补丁/模块迁移/seed 保留。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema.sql | 拆分并删除 | 原单文件 schema 已拆分为 db/schema/*.sql 并删除；备份 data/backup/file_cleanup_20261028/db__schema.sql。 | deleted | 28 | 2026-10-28T18:45:00+03:00 | data/backup/file_cleanup_20261028/db__schema.sql |
| tests/smoke_books.py | 保留 | 书籍阅读 API 冒烟，临时库、端口 8897；覆盖导入/占位/清洗/词库/复制/删除；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| tests/smoke_file_preview.py | 保留 | 文件预览后端冒烟：扫描排除、DB 识别、说明/规则 CRUD、越界拒绝；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| tests/smoke_model_usage.py | 迁移模型用量冒烟到插件 API | 49 条模型用量冒烟：CRUD/价目走 /api/plugin/model_usage/*，并断言旧路由 404。 | updated | 24 | 2026-10-28T13:20:48+03:00 | data/backup/file_cleanup_20261028/tests/smoke_model_usage.py |
| tests/smoke_pm.py | 保留 | 项目管理器 API 冒烟：模板、项目、提示词、结果、格式面板、删除级联；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| tests/smoke_reader_range.py | 保留 | 待清洗范围与分组下载配置冒烟，临时库、端口 8897；保留。 | reviewed | 11 | 2026-10-27T17:37:14+03:00 |  |
| tests/smoke_startup_once.py | 新增模块关闭回归 | db/schema/*.sql 静态断言；关闭 pm/model_usage/finance 不建表、API 503、恢复后自动建表；25/25。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| tests/smoke_web.py | 保留 | Web/学习/背景库/阅读/打卡综合冒烟，临时库、端口 8898；P3 批 1 给 /api/tts 加 try/except，502 只记 FAIL 不中断；保留。 | reviewed | 21 | 2026-10-28T00:48:28+03:00 |  |
| data/ai_cobuild.json | 保留 | 多 AI 共建打卡主数据源；当前 49 条记录；自动镜像 docs/多AI共建日志.md。 建议：保留；只追加/作废，不手改。 | reviewed | 28 | 2026-10-28T18:45:43+03:00 |  |
| data/ai_keys.json | 保留 | 第三批 data 只读审查：AI 工作台 API Key 与模型名配置；当前键名 kimi/kimi_model/doubao/doubao_model；本轮只读键名与类型，未回显值。 建议：保留但提升密钥管理；文件预览排除，禁止导出/写入 manifest。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| data/doubao_archive.json | 保留 | 第三批 data 只读审查：豆包 UIA 历史问答归档；当前 20 条，字段 hash/time/question_time/question/cost/reply。 建议：保留历史；确认不再展示后再评估归档策略，不静默删除。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| data/doubao_history.json | 保留 | 第三批 data 只读审查：豆包 UIA 消息历史与去重基线；当前 messages 530 条、baseline 20 条。 建议：保留；与 archive 明确边界，避免重复增长。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| data/filejudge_keep.json | 保留·只读旧数据 | 第三批 data 只读审查：文件判官「已保留」路径清单；当前 81 条。 建议：保留；路径失配时提示重扫，不自动删除。 P3 批 2：首次加载复制到 data/plugins/filejudge/keep.json；本文件保留只读，仅作备份，不再更新。 | done | 22 | 2026-10-28T01:20:41+03:00 |  |
| data/fund_list_cache.json | 保留 | 第三批 data 只读审查：基金代码/名称/类型列表缓存；当前 27995 条，字段 code/name/type。 建议：保留为可重建缓存；后续可加更新时间/版本。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| data/rivet.json | 保留·只读旧数据 | 第三批 data 只读审查：铆钉点习惯数据；当前 2 个 habit，含 records 等字段。 建议：保留；备份时与 DB 一起保存；后续补版本/迁移说明。 P3 批 1：首次加载复制到 data/plugins/rivet/rivet.json；本文件保留只读，不再写入。 | done | 21 | 2026-10-28T00:48:28+03:00 |  |
| data/russian_tutor.db | 保留 | 主 SQLite 数据库；当前 63 张表、23 items、23 item_stats、2 themes、81 bg_nodes、164 file_notes、83 bg_versions；schema 拆分前后表集合一致。finance_* 15 账户/27 快照未变。 建议：保留；模块开关只影响新建表，不删除已有表。 | reviewed | 28 | 2026-10-28T18:45:43+03:00 | data/backup/russian_tutor_pre_bg_db_final_20261028.db |
| data/settings.json | 保留 | 运行时设置；当前 7 个顶层键：ru_family、ru_size、new_quota、review_quota、model_pricing、download_groups、modules.enabled（8 模块默认全 true）。建议：保留；共享写入需原子/备份。 | reviewed | 28 | 2026-10-28T18:45:43+03:00 |  |
| data/webchat_sessions.json | 保留 | 第三批 data 只读审查：网页会话链接列表；当前 1 条，字段 id/name/url/ts。 建议：保留；URL 属本地敏感信息，不导出到 manifest。 | reviewed | 12 | 2026-10-27T18:38:58+03:00 |  |
| docs/archive/download-export-feasibility-2026-10-24.md | 归档 | 用户确认归档到 docs/archive/；原路径 docs/download-export-feasibility-2026-10-24.md；历史可行性分析/按钮清单：下载/导出地址指定能力、浏览器能力对比、全量按钮清单、风险与 2026-10-24 落地记录。未逐行阅读，未回显内部路径。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/多AI共建日志.md | 保留 | 用户确认保留原位；多 AI 共建打卡的自动生成 Markdown 镜像，当前 49 条记录；数据源 data/ai_cobuild.json。 | done | 28 | 2026-10-28T18:45:43+03:00 |  |
| docs/_boot_out.txt | 删除 | 用户确认删除；先备份后删除；一行 Web UI 启动失败/回退记录（111 字节）。依据文件名与单行日志类型推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 | data/backup/file_cleanup_2026-10-27 |
| docs/archive/_fin_cashfix2.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_fin_cashfix2.js；一次性 Node 补丁脚本：改写 ui/web/static/app.js 的 finance cash/cost 逻辑；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_fin_fmt.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_fin_fmt.js；一次性 Node 补丁脚本：调整 finance 百分比格式化相关代码；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_fin_opt.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_fin_opt.js；一次性 Node 补丁脚本：finance 迁移/年化收益等多项改动；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_fix_patch.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_fix_patch.js；一次性 Node 补丁脚本：汇率历史/首末日期等修复；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_fix2.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_fix2.js；一次性 Node 清理脚本：删除 fxh 旧事件块；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_plan_donefix.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_plan_donefix.js；一次性 Node 补丁脚本：计划完成状态与同 id 顺延副本同步；含 writeFileSync/NO MATCH 退出。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_repro.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_repro.js；Node 复现/断言脚本：加载 app.js head 到 vm，准备 sandbox 并 PASS/FAIL；用于历史问题复现。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/_rv_err.txt | 删除 | 用户确认删除；先备份后删除；review 相关错误日志（10 行、610 字节，含 traceback 标记）。依据文件名/行数推导，未逐行阅读；仅检查行数/类型，未回显正文。 | done | 13 | 2026-10-27T19:44:31+03:00 | data/backup/file_cleanup_2026-10-27 |
| docs/_rv_out.txt | 删除 | 用户确认删除；先备份后删除；review 输出日志（2 行、55 字节）。依据文件名/行数推导，未逐行阅读；仅检查行数/类型，未回显正文。 | done | 13 | 2026-10-27T19:44:31+03:00 | data/backup/file_cleanup_2026-10-27 |
| docs/archive/_test_dep.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_test_dep.js；Node 测试脚本：加载 app.js head 到 vm，对历史依赖/格式化行为做 PASS/FAIL 断言；无写入。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_test_dep2.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_test_dep2.js；Node 测试脚本（_test_dep 的后续版本）：加载 app.js head 到 vm 做 PASS/FAIL 断言；无写入。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_test_donefix.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_test_donefix.js；Node 测试脚本：验证计划完成/同 id 顺延副本同步等历史修复；加载 app.js head 到 vm，PASS/FAIL 断言，无写入。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/archive/_test_repro.js | 归档 | 用户确认归档到 docs/archive/；原路径 docs/_test_repro.js；Node 测试脚本：复现/验证 finance 历史问题，加载 app.js head 到 vm 做 PASS/FAIL 断言；无写入。依据文件名/文件头推导，未逐行阅读。 | done | 13 | 2026-10-27T19:44:31+03:00 |  |
| docs/_tres.txt | 删除 | 用户确认删除；先备份后删除；测试结果快照（1 行、14 字节，PASS/FAIL 计数）。依据文件名/行数推导，未逐行阅读；仅检查行数/类型，未回显正文。 | done | 13 | 2026-10-27T19:44:31+03:00 | data/backup/file_cleanup_2026-10-27 |
| modules/__init__.py | 审查完成·保留 | 第五批 modules 只读审查；标记 modules 为 Python 包；空实现避免导入副作用。 建议：保留 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/ai_bridge.py | 审查完成·保留 | 第五批 modules 只读审查；多平台 OpenAI 兼容对话、Key/模型状态与保存。 建议：保留；后续规范化密钥与错误边界 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/bg_library.py | 审查完成·保留 | 第五批 modules 只读审查；背景库核心：树、导入/导出、手动变更、删除、历史与 API。 建议：保留；后续规范化（1596 行） | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/book_reader.py | 阅读资产解析走 pixel_art 插件 | /api/reader/assets 契约保留，内部调用 plugins/pixel_art/backend.py 暴露的资产解析函数。 | updated | 14 | 2026-10-27T20:34:14+03:00 | data/backup/file_cleanup_20261028/modules/book_reader.py |
| modules/cobuild.py | 审查完成·保留 | 第五批 modules 只读审查；多 AI 共建声明与打卡 JSON/镜像。 建议：保留 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/crawler.py | 审查完成·保留 | 第五批 modules 只读审查；网页抓取/纯文本摘要。 建议：保留；后续规范化 URL/超时/错误文案 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/doubao_watch.py | 审查完成·保留 | 第五批 modules 只读审查；豆包 UIA 监听、状态/消息解析、归档/历史。 建议：保留；后续规范化可选依赖与 COM 线程 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/file_judge.py | 删除（迁为插件 backend） | P3 批 2：业务整体迁至 plugins/filejudge/backend.py；T1 核实无外部 import（仅 server.py 旧 /api/filejudge 分支），旧路由已删；原件备份后删除。 | done | 22 | 2026-10-28T01:20:41+03:00 | data/backup/file_cleanup_2026-10-28 |
| modules/file_preview.py | 审查完成·保留 | 第五批 modules 只读审查；工作区扫描/排除、DB 识别、file_notes/db_rules、API。 建议：保留；后续规范化扫描缓存 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/fund_nav.py | 审查完成·保留 | 第五批 modules 只读审查；基金列表与历史净值，24h 缓存。 建议：保留；后续规范化网络错误/缓存版本 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/godot_bridge.py | 删除 | pixel 动画/Godot 导入整体下线；后端桥接已移除。初设计基于 Godot，曾引入“某一”文件夹存放 Godot 软件，该文件夹已移除。 | deleted | 14 | 2026-10-27T20:34:14+03:00 | data/backup/file_cleanup_20261028/modules/godot_bridge.py |
| modules/importer.py | 审查完成·保留 | 第五批 modules 只读审查；Markdown/管道/JSON 批量导入解析。 建议：保留；后续规范化格式边界 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/model_usage.py | 保留为插件业务模块 | 保留原业务校验与价目规则，由 plugins/model_usage/backend.py 调用；SQL仍走 core/repository.py。 | updated | 14 | 2026-10-27T20:34:14+03:00 | data/backup/file_cleanup_20261028/modules/model_usage.py |
| modules/pdf_tools.py | 删除（迁为插件 backend） | P4 批 1：业务整体迁至 plugins/pdf/backend.py；T2.1 核实无外部 import（仅 server.py 旧 /api/pdf/*、/api/batch/* 分支），旧路由已删；原件备份后删除。 | done | 23 | 2026-10-28T01:53:56+03:00 | data/backup/file_cleanup_2026-10-28 |
| modules/pixel_art.py | 保留为插件业务模块 | 保留像素画业务校验；作品、资产引用与视觉设置 SQL 改由 core/repository.py 封装。 | updated | 14 | 2026-10-27T20:34:14+03:00 | data/backup/file_cleanup_20261028/modules/pixel_art.py |
| modules/pm_repository.py | 审查完成·保留 | 第五批 modules 只读审查；PM 模板/项目/阶段/草稿/结果 SQL 层。 建议：保留；后续规范化事务/索引 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/pm_service.py | 审查完成·保留 | 第五批 modules 只读审查；PM 六阶段、提示词、结果快照/上下文/导出。 建议：保留；后续规范化错误类型 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/pm_templates.py | 审查完成·保留 | 六阶段空壳 seed 保持幂等（仅空表插入）；import 时向 db.connection 注册 register_seed_callback，不覆盖已有内容。 | done | 25 | 2026-10-28T14:02:44+03:00 |  |
| modules/rivet.py | 删除（迁为插件 backend） | P3 批 1：业务整体迁至 plugins/rivet/backend.py；T1 核实无外部 import（仅 server.py 旧 /api/rivet 分支），旧路由已删；原件备份后删除。 | done | 21 | 2026-10-28T00:48:28+03:00 | data/backup/file_cleanup_2026-10-28 |
| modules/seed.py | 审查完成·保留 | 第五批 modules 只读审查；7 主题 + 32 条种子，首次/空库导入，按俄语去重。 建议：保留；后续规范化种子类型/版本 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/settings_store.py | 新增 modules.enabled 读取 | modules_enabled()/module_enabled()：缺失模块或整段默认 true；不改浅合并/原子写。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| modules/tts.py | 审查完成·保留 | 第五批 modules 只读审查；后台朗读、缓存、edge-tts、系统播放/清理。 建议：保留；后续规范化依赖缺失提示 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| modules/web_chat.py | 审查完成·保留 | 第五批 modules 只读审查；Playwright 常驻浏览器、登录、发送/取回复、会话列表。 建议：保留；后续规范化选择器/超时 | reviewed | 14 | 2026-10-27T20:34:14+03:00 |  |
| webchat_profile/ | 审查完成·保留 | webchat_profile 只读结构审查：658 个文件、68 个目录、约 143MB；识别 Chromium profile 的登录态/存储/缓存/崩溃/指标类别，18 个关键文件写入 file_notes（source=manual）。敏感值未读取/未回显；抽样识别，未逐文件读取。file_preview 将 webchat_profile 列入 EXCLUDE_DIR_NAMES，因此有 file_notes 但不在文件树/manifest。 | reviewed | 15 | 2026-10-27T22:27:41+03:00 |  |
| ui/__init__.py | 审查完成·保留 | 第六批 ui 只读审查；ui 包初始化，空实现。 建议：保留 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/cli.py | 审查完成·保留 | 第六批 ui 只读审查；CLI 入口与 9 个子命令分发。 建议：保留；后续规范化参数/错误文案 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/gui.py | 审查完成·保留 | 第六批 ui 只读审查；经典 Tkinter 入口，8 页 notebook。 建议：保留；后续与 Web 共享规则 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/server.py | 捕获 module_disabled | 捕获 ModuleDisabledError -> 503 {ok:false,error:'module_disabled',module,message}；插件 backend 不吞该异常。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| ui/web/static/index.html | 审查完成·保留 | 第六批 ui 只读审查；Web 单页外壳。 建议：保留；无框架/无构建 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/app.js | 内置 TOOLS 移除 finance/finquant | 内置 7 + 插件 12（14 entry）=21 卡片；finance/finquant 由插件 entry 注册。 | updated | 26 | 2026-10-28T17:21:22+03:00 |  |
| ui/web/static/app.css | 删除像素动画专用样式 | 核对动画前缀样式只用于 pixel.js 后移除；pixel_art 共享 .pa 样式保留。 | updated | 16 | 2026-10-27T22:37:48+03:00 | data/backup/file_cleanup_20261028/ui/web/static/app.css |
| ui/web/static/favicon.ico | 审查完成·保留 | 第六批 ui 只读审查；ICO 标签图标。 建议：保留 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/favicon.png | 审查完成·保留 | 第六批 ui 只读审查；PNG 标签图标。 建议：保留 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/ai.js | 审查完成·保留 | 第六批 ui 只读审查；AI 工作台多平台对话前端。 建议：保留；统一错误/状态 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/aidebug.js | 审查完成·保留 | 第六批 ui 只读审查；接口调试器/网页 DS 原文抓取。 建议：保留；统一解析/错误 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/batch.js | 删除（迁为插件 feature） | P4 批 1：前端迁至 plugins/pdf/feature_pdf.js / feature_batch.js，仅 API 路径改为 /api/plugin/pdf/pdf/* 与 /api/plugin/pdf/batch/*；原件备份后删除。 | done | 23 | 2026-10-28T01:53:56+03:00 | data/backup/file_cleanup_2026-10-28 |
| ui/web/static/features/bg_library.js | 审查完成·保留 | 第六批 ui 只读审查；背景库+文件预览前端。 建议：保留；文件树/工具函数整理 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/book_reader.js | 审查完成·保留 | 第六批 ui 只读审查；书籍阅读/标注/清洗/词库/阅读屏入口。 建议：保留；与 reader_screen 共享规则 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/expdata.js | 迁移到插件·删除原件 | P2 批 1：实验数据获取原内置前端；已迁移为 plugins/expdata/feature.js。 旧文件验证后删除；原件已备份。 | done | 18 | 2026-10-27T23:41:19+03:00 | data/backup/file_cleanup_2026-10-27 |
| ui/web/static/features/filejudge.js | 删除（迁为插件 feature） | P3 批 2：前端迁至 plugins/filejudge/feature.js，仅 API 路径改为 /api/plugin/filejudge/*；原件备份后删除。 | done | 22 | 2026-10-28T01:20:41+03:00 | data/backup/file_cleanup_2026-10-28 |
| ui/web/static/features/finance.js | 删除 | 原记账本前端迁至 plugins/finance/feature_finance.js；旧文件已备份后删除。 | deleted | 26 | 2026-10-28T17:21:22+03:00 | data/backup/file_cleanup_20261028/ui__web__static__features__finance.js |
| ui/web/static/features/model_usage.js | 迁移至 plugins/model_usage/feature.js | 模型用量前端迁为插件 feature，调用 /api/plugin/model_usage/*。 | migrated | 16 | 2026-10-27T22:37:48+03:00 | data/backup/file_cleanup_20261028/ui/web/static/features/model_usage.js |
| ui/web/static/features/pdf.js | 删除（迁为插件 feature） | P4 批 1：前端迁至 plugins/pdf/feature_pdf.js / feature_batch.js，仅 API 路径改为 /api/plugin/pdf/pdf/* 与 /api/plugin/pdf/batch/*；原件备份后删除。 | done | 23 | 2026-10-28T01:53:56+03:00 | data/backup/file_cleanup_2026-10-28 |
| ui/web/static/features/pixel.js | 删除 | pixel 动画前端已删除。功能初设计基于 Godot，曾引入“某一”文件夹存放 Godot 软件，该文件夹已移除；pixel 功能整体下线。历史引用保留。 | deleted | 16 | 2026-10-27T22:37:48+03:00 | data/backup/file_cleanup_20261028/ui/web/static/features/pixel.js |
| ui/web/static/features/pixel_art.js | 迁移至 plugins/pixel_art/feature.js | 像素画前端迁为 pixel_art 插件，API 改走 /api/plugin/pixel_art/*。 | migrated | 16 | 2026-10-27T22:37:48+03:00 | data/backup/file_cleanup_20261028/ui/web/static/features/pixel_art.js |
| ui/web/static/features/project_manager.js | 审查完成·保留 | 第六批 ui 只读审查；PM 六阶段/提示词/结果/上下文前端。 建议：保留；与 PM service 错误统一 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/promptgen.js | 审查完成·保留 | 第六批 ui 只读审查；提示词生成器四界面前端。 建议：保留；拆分 175KB 单文件 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/reader_screen.js | 审查完成·保留 | 第六批 ui 只读审查；书籍阅读内部全屏阅读屏（三阅读层级/遮挡/高亮/折叠）。 建议：保留；与 book_reader 共享状态 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/rivet.js | 删除（迁为插件 feature） | P3 批 1：前端迁至 plugins/rivet/feature.js，仅 API 路径改为 /api/plugin/rivet/*；原件备份后删除。 | done | 21 | 2026-10-28T00:48:28+03:00 | data/backup/file_cleanup_2026-10-28 |
| ui/web/static/features/russian.js | 审查完成·保留 | 第六批 ui 只读审查；俄语单词背诵 hub：闪卡/计划/复习/导入/知识库/统计 8 视图。 建议：保留；拆分子模块 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/schedule.js | 迁移到插件·删除原件 | P2 批 1：计划表原内置前端；已迁移为 plugins/schedule/feature.js。 旧文件验证后删除；原件已备份。 | done | 18 | 2026-10-27T23:41:19+03:00 | data/backup/file_cleanup_2026-10-27 |
| ui/web/static/features/screeps.js | 迁移到插件·删除原件 | P2 批 2：Screeps Arena 原内置前端；已迁移为 plugins/screeps/feature.js。 旧文件验证后删除；原件已备份。 | done | 19 | 2026-10-28T00:00:36+03:00 | data/backup/file_cleanup_2026-10-27 |
| ui/web/static/features/sim.js | 迁移到插件·删除原件 | P1 插件化：sim 已原样迁至 plugins/sim/feature.js；旧内置 feature 验证后删除，原件备份在 data/backup/file_cleanup_2026-10-27/。 | done | 17 | 2026-10-27T23:16:44+03:00 | data/backup/file_cleanup_2026-10-27 |
| ui/web/static/features/webchat.js | 审查完成·保留 | 第六批 ui 只读审查；共享会话能力 getSession/chatPost/parseJSON。 建议：保留；与 web_chat 前端整合 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
| ui/web/static/features/webtools.js | 迁移到插件·删除原件 | P2 批 2：原 webtools 一个文件两个入口；已拆为 urlarch 与 netexp 两个独立插件。 旧文件验证后删除；原件已备份。 | done | 19 | 2026-10-28T00:00:36+03:00 | data/backup/file_cleanup_2026-10-27 |
| docs/bg-update-bg-cli-md-download-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base/current 各 8 节点。 建议：保留原位；建议归档 docs/archive/bg-updates/（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-book-vocab-rounds-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base/current 各 3 节点。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-cleaning-task-nav-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base/current 各 7 节点。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-flow-rewrite-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base 19/current 18/changed 4。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-internal-ref-home-download-2026-10-24.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-24 背景库 update 包；base 10/current 12/changed 10。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-pixel-art-ai-log-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base 8/current 10/changed 8。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-promptgen-bg-readerscreen-2026-10-24.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-24 背景库 update 包；base/current 各 14 节点。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-promptgen-groups-internal-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base/current 各 7 节点。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-reader-vocab-sidebar-2026-10-24.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-24 背景库 update 包；base/current 各 9 节点。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/bg-update-tree-delete-2026-10-23.json | 审查完成·建议归档 | 补充批次只读核对；2026-10-23 背景库 update 包；base 5/current 3/changed 3。 建议：保留原位；建议归档（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| docs/ui_favicon.png | 审查完成·建议归档 | 补充批次只读核对；256×256 RGBA PNG 静态图标副本。 建议：保留原位；建议归档或删除（待确认） | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| tools/bg_archive_stale.py | 审查完成·保留 | 补充批次只读核对；一次性运维脚本：把旧背景树非 deprecated 节点整体作废并打卡；默认演练，--apply 才写入。 建议：保留并标注勿误跑 --apply；归档需确认 | reviewed | 17 | 2026-10-27T22:47:05+03:00 |  |
| plugins/sim/manifest.json | 新建插件·保留 | P1 插件化：随机模拟器插件清单。 | done | 17 | 2026-10-27T23:16:44+03:00 |  |
| plugins/sim/feature.js | 新建插件·保留 | P1 插件化：随机模拟器插件前端（原 sim.js 原样迁移）。 | done | 17 | 2026-10-27T23:16:44+03:00 |  |
| plugins/expdata/manifest.json | 新建插件·保留 | P2 批 1：实验数据获取插件清单。 | done | 18 | 2026-10-27T23:41:19+03:00 |  |
| plugins/expdata/feature.js | 新建插件·保留 | P2 批 1：实验数据获取插件前端（原 expdata.js 原样迁移）。 | done | 18 | 2026-10-27T23:41:19+03:00 |  |
| plugins/schedule/manifest.json | 新建插件·保留 | P2 批 1：计划表插件清单。 | done | 18 | 2026-10-27T23:41:19+03:00 |  |
| plugins/schedule/feature.js | 新建插件·保留 | P2 批 1：计划表插件前端（原 schedule.js 原样迁移）。 | done | 18 | 2026-10-27T23:41:19+03:00 |  |
| plugins/screeps/manifest.json | 新建插件·保留 | P2 批 2：Screeps Arena 插件清单。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| plugins/screeps/feature.js | 新建插件·保留 | P2 批 2：Screeps Arena 插件前端（原样迁移）。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| plugins/urlarch/manifest.json | 新建插件·保留 | P2 批 2：网址归档插件清单。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| plugins/urlarch/feature.js | 新建插件·保留 | P2 批 2：网址归档插件前端（从 webtools 拆出）。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| plugins/netexp/manifest.json | 新建插件·保留 | P2 批 2：网络与互联探索插件清单。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| plugins/netexp/feature.js | 新建插件·保留 | P2 批 2：网络与互联探索占位前端（从 webtools 拆出）。 | done | 19 | 2026-10-28T00:00:36+03:00 |  |
| tests/smoke_plugins.py | 插件双重控制回归 | manifest.enabled 仍控制 UI；modules.enabled 由 startup 测试覆盖；12 插件/14 entry/21 卡片。 | updated | 28 | 2026-10-28T18:45:00+03:00 |  |
| docs/plugin-css-decision-2026-10-28.md | 新建文档·保留 | CSS 去留结论定型：实测口径、不拆分理由、重开触发条件（12KB/8%）、若重开的实施草案与维护约定。 | done | 20 | 2026-10-28T00:22:30+03:00 |  |
| ui/web/static/app.css（插件 CSS 残留） | 保留·不插件化（结论定型） | L0 六个插件专用 CSS 实测 109 行/9145B（app.css 2384 行/155901B 的 5.87%），共享 .rv-card 2 行/284B；plugins/ 无 .css、manifest 无 style/css 字段。拆分收益低且需与全站主题/共享组件同载，故继续统一放 app.css，不拆 plugin.css。结论与重开条件见 docs/plugin-css-decision-2026-10-28.md；tests/smoke_plugins.py 固化阈值（≤12000B 且 ≤8%）与锚点。 | done | 20 | 2026-10-28T00:22:30+03:00 |  |
| plugins/rivet/manifest.json | 新建插件·保留 | P3 批 1：rivet 插件清单；id=rivet、feature=feature.js、backend=backend.py、enabled=true、shelf=gen。 | done | 21 | 2026-10-28T00:48:28+03:00 |  |
| plugins/rivet/backend.py | 新建插件·保留 | P3 批 1：承接原 modules/rivet.py 的全部业务逻辑；handle() 分发 data/habit/save/habit/delete/checkin/note；数据路径 data/plugins/rivet/rivet.json，首次从旧 data/rivet.json 复制。 | done | 21 | 2026-10-28T00:48:28+03:00 |  |
| plugins/rivet/feature.js | 新建插件·保留 | P3 批 1：原 features/rivet.js 迁入；渲染/事件/统计展示原样保留，API 改为 /api/plugin/rivet/*，仍注册 window.__toolRenderers.rivet。 | done | 21 | 2026-10-28T00:48:28+03:00 |  |
| data/plugins/rivet/rivet.json | 新建数据·保留 | P3 批 1：首次加载从 data/rivet.json 复制；旧文件保留只读，新文件为后续读写目标。 | done | 21 | 2026-10-28T00:48:28+03:00 |  |
| plugins/filejudge/manifest.json | 新建插件·保留 | P3 批 2：filejudge 插件清单；id=filejudge、feature=feature.js、backend=backend.py、enabled=true、shelf=gen。 | done | 22 | 2026-10-28T01:20:41+03:00 |  |
| plugins/filejudge/backend.py | 新建插件·保留 | P3 批 2：承接原 modules/file_judge.py 的扫描/筛选/预览/缩略图/保留/删除/目录树；handle() 分发 scan/preview/thumbs/keep/tree/reveal/delete；数据路径 data/plugins/filejudge/keep.json，首次从旧 data/filejudge_keep.json 复制；Pillow/PyPDF2/python-docx 函数内延迟导入。 | done | 22 | 2026-10-28T01:20:41+03:00 |  |
| plugins/filejudge/feature.js | 新建插件·保留 | P3 批 2：原 features/filejudge.js 迁入；四视图交互原样保留，API 改为 /api/plugin/filejudge/*，仍注册 window.__toolRenderers.filejudge。 | done | 22 | 2026-10-28T01:20:41+03:00 |  |
| data/plugins/filejudge/keep.json | 新建数据·保留 | P3 批 2：首次加载从 data/filejudge_keep.json 复制；旧文件保留只读，新文件为后续保留清单读写目标。 | done | 22 | 2026-10-28T01:20:41+03:00 |  |
| plugins/pdf/manifest.json | 新建插件·保留 | P4 批 1：PDF 与压缩多入口插件清单；id=pdf、backend=backend.py；entries=pdf（PDF 工具）与 batch（批量压缩）。 | done | 23 | 2026-10-28T01:53:56+03:00 |  |
| plugins/pdf/backend.py | 新建插件·保留 | P4 批 1：承接整个 modules/pdf_tools.py；handle 分发 pdf/merge\|split\|compress\|images\|compress-images 与 batch/scan\|compress；pikepdf/PIL 函数内延迟导入；成功时 __binary__ 响应，缺依赖 missing_dependency。 | done | 23 | 2026-10-28T01:53:56+03:00 |  |
| plugins/pdf/feature_pdf.js | 新建插件·保留 | P4 批 1：原 features/pdf.js 迁入，API 改为 /api/plugin/pdf/pdf/*，注册 renderer.pdf。 | done | 23 | 2026-10-28T01:53:56+03:00 |  |
| plugins/pdf/feature_batch.js | 新建插件·保留 | P4 批 1：原 features/batch.js 迁入，API 改为 /api/plugin/pdf/batch/*，注册 renderer.batch。 | done | 23 | 2026-10-28T01:53:56+03:00 |  |
| ui/web/plugin_routes.py | 登记 finance 插件 | 新增 finance 路由（prefix=/api/plugin/finance/，entries=finance/finquant，backend=plugins/finance/backend.py）；继续作为唯一插件分发源。 | updated | 26 | 2026-10-28T17:21:22+03:00 |  |
| plugins/model_usage/manifest.json | 新增 model_usage 插件清单 | 插件 id 使用 model_usage；保留模型用量卡片 entry 与展示元数据。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| plugins/model_usage/backend.py | 新增 model_usage 插件后端 | 转调 modules/model_usage 业务函数与 core.repository 公共接口，不复制 SQL。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| plugins/model_usage/feature.js | 新增 model_usage 插件前端 | 承接原模型用量界面并改用 /api/plugin/model_usage/*。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| plugins/pixel_art/manifest.json | 新增 pixel_art 插件清单 | 插件 id 使用 pixel_art；保留像素画卡片 entry 与展示元数据。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| plugins/pixel_art/backend.py | 新增 pixel_art 插件后端 | 承接 /api/pixel/* 子路径插件化处理，并暴露 reader assets 解析函数；不依赖 book_reader。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| plugins/pixel_art/feature.js | 新增 pixel_art 插件前端 | 承接原像素画界面并改用 /api/plugin/pixel_art/*；历史动画/Godot 引用保留在审计记录。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| tools/gen_file_navigation_md.py | 新增 docs/appendix/file_navigation.md 生成器 | 标准库脚本以 docs/appendix/file_navigation.json 为主数据源生成只读摘要；不得手改 Markdown。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
| ui/web/static/finance_migration.html | 删除 | 一次性 rt_fin 导出页，迁移验证后删除；备份保留。 | deleted | 26 | 2026-10-28T17:21:22+03:00 | data/backup/file_cleanup_20261028/ui__web__static__finance_migration.html |
| plugins/finance/manifest.json | 新增 finance 插件清单 | 一个插件两个 entry（finance/finquant）；backend=backend.py；finquant 为数据重置占位。 | added | 26 | 2026-10-28T17:21:22+03:00 |  |
| plugins/finance/backend.py | finance 解冻·恢复后端 | 数据确认无丢失；归因明细为实时计算，无需恢复数据；已用冻结前备份还原，恢复正常 API 读写。 | restored | 27 | 2026-10-28T18:05:36+03:00 |  |
| plugins/finance/shared.js | 新增 finance 共享纯函数 | 格式化、日期、币种换算、图表 helper、localStorage 键常量；无 DOM/无业务状态。 | added | 26 | 2026-10-28T17:21:22+03:00 |  |
| plugins/finance/feature_finance.js | finance 解冻·恢复前端 | 数据确认无丢失；归因明细为实时计算，无需恢复数据；已用冻结前备份还原，恢复正常 API 读写。 | restored | 27 | 2026-10-28T18:05:36+03:00 |  |
| plugins/finance/feature_finquant.js | 新增理财量化占位 | 数据已重置，功能待重构；不调用 API、不读写 finance_*。 | added | 26 | 2026-10-28T17:21:22+03:00 |  |
| tools/migrate_finance_localstorage.py | 新增 rt_fin 迁移脚本 | 支持 --dry-run/--apply/--force；BEGIN IMMEDIATE 单事务、幂等、失败回滚；apply 前校验双备份；写入 finance_settings.migrated_at/migration_source；不删除输入。 | added | 26 | 2026-10-28T17:21:22+03:00 |  |
| tests/smoke_finance.py | 新增 finance 回归 | 覆盖迁移 dry-run/apply/force、状态结构、账户/原因/快照 CRUD、旧路由 404、finquant 占位；临时库/端口 8897。 | added | 26 | 2026-10-28T17:21:22+03:00 |  |
| data/finance_migration/rt_fin.json | 迁移输入·保留 | 用户提供的 rt_fin 完整导出，只读输入；迁移后保留，不导出到 manifest；含财务数据仅本地保存。 | reviewed | 26 | 2026-10-28T17:21:22+03:00 |  |
| plugins/finance/ | finance 解冻 | 冻结排查结束：rt_fin/DB 一致，归因明细实时计算；前端/后端已还原，写接口恢复。 | restored | 27 | 2026-10-28T18:05:36+03:00 |  |
| db/schema/core.sql | 新增拆分 schema | core 模块 DDL：items/item_stats/review_logs/daily_logs/themes + visual_settings。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/pm.sql | 新增拆分 schema | pm 模块 DDL：pm_* 五表。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/reader.sql | 新增拆分 schema | reader 模块 DDL：书籍/层级/句子/词库/标记/导入清洗。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/bg.sql | 新增拆分 schema | bg 模块 DDL：bg_nodes/bg_versions。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/file_notes.sql | 新增拆分 schema | file_notes 模块 DDL：file_notes/db_rules。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/model_usage.sql | 新增拆分 schema | model_usage 模块 DDL：model_usage_logs。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/pixel.sql | 新增拆分 schema | pixel 模块 DDL：pixel_artworks/pixel_asset_refs。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| db/schema/finance.sql | 新增拆分 schema | finance 模块 DDL：finance_* 17 表。 | added | 28 | 2026-10-28T18:45:00+03:00 |  |
| config.py | 已解决 | 保留为宿主/插件共享配置；已确认不再承载业务 DDL 或插件路由。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |
| webchat_probe.py | 已解决 | 保留为网页会话最小验证脚本，非运行必需。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |
| db/connection.py | 已解决 | 已彻底插件化：db/schema/ 为空，全部建表由 plugins/*/schema.sql + manifest 驱动；core/repository.py 已删除。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |
| modules/ | 已解决 | 已完成：bg/file_preview/seed/importer/book_reader/pm 等业务模块均已下沉到插件。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |
| ui/ | 已解决 | 已完成：19 个插件、0 个内置工具；GUI/CLI 退役；server.py 只保留宿主能力。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |
| docs/bg-update-*.json / docs/ui_favicon.png / tools/bg_archive_stale.py | 已解决 | 历史 docs 保留；废弃 tools/bg_archive_stale.py 已删除；导航 pending 清零。 | done | 29 | 2026-10-28T21:50:52+03:00 |  |

## 文件审查分类与建议

| 路径 | 分类 | 角色 | 建议 | 可替代性 | 集成 | 风险 |
| --- | --- | --- | --- | --- | --- | --- |
| download_groups | 业务配置 | 按功能分组的浏览器下载目录偏好 | 新建 backend-only plugins/downloads，宿主 /api/settings 转调，暂不改前端路径 | 中 | app.js + /api/settings + smoke_reader_range/smoke_web |  |
| modules/web_chat.py | 业务模块归属 | 业务模块 web_chat.py | 建议新建 plugins/webchat/ | 中 | frontend: ai/finance/app shared |  |
| modules/doubao_watch.py | 业务模块归属 | 业务模块 doubao_watch.py | 建议并入 plugins/aidebug/ | 中 | frontend: aidebug |  |
| modules/crawler.py | 业务模块归属 | 业务模块 crawler.py | 建议并入 plugins/finance/ | 中 | frontend: finance |  |
| modules/ai_bridge.py | 业务模块归属 | 业务模块 ai_bridge.py | 建议并入 plugins/ai/ | 中 | frontend: ai/finance |  |
| modules/settings_store.py::MODULES | 模块开关 | 宿主兼容模块列表 | 暂缓收缩；先稳定 decoupling |  | modules_enabled/module_enabled 当前无外部调用；db.connection 独立读 modules.enabled |  |
| modules/web_chat.py | 宿主 modules 调查 | 宿主网页会话 | 保留为宿主集成能力；敏感会话不导出 | 中 | ui/web/server.py | 中 |
| modules/visual_settings.py | 宿主 modules 调查 | 共享 SQL 访问 | 按 round 33 建议下沉到 plugins/pixel_art/（或独立 visual 插件）；需迁移 visual_settings 表并同步引用 | 低 | modules/pixel_art.py; plugins/book_reader/book_reader.py | 高 |
| modules/tts.py | 宿主 modules 调查 | 宿主媒体能力 | 待裁决：独立 tts 插件或并入 russian/book_reader；本轮不移动 | 中 | ui/web/server.py | 中 |
| modules/settings_store.py | 宿主 modules 调查 | 宿主基础设施 | 保留；modules.enabled 等多方依赖 | 中 | ui/web/server.py; modules/model_usage.py; modules/web_chat.py; plugins/russian/backend.py | 中 |
| modules/pixel_art.py | 宿主 modules 调查 | 像素画业务 | 下沉到 plugins/pixel_art/；同步改 book_reader 反向 import，visual_settings 一并裁决 | 低 | plugins/pixel_art/backend.py; plugins/book_reader/book_reader.py | 高 |
| modules/model_usage.py | 宿主 modules 调查 | 模型用量业务 | 下沉到 plugins/model_usage/；已有 backend.py/repo.py，需同步改 reverse import | 低 | plugins/model_usage/backend.py | 高 |
| modules/fund_nav.py | 宿主 modules 调查 | 基金数据访问 | 下沉到 plugins/finance/backend.py；同步移除宿主 /api/fund/* 或保留兼容壳 | 中 | ui/web/server.py | 中 |
| modules/doubao_watch.py | 宿主 modules 调查 | 宿主 Windows 集成 | 保留为宿主集成能力，敏感 JSON 不导出 | 中 | ui/web/server.py | 中 |
| modules/crawler.py | 宿主 modules 调查 | 宿主网络能力 | 保留为宿主基础设施 | 中 | ui/web/server.py | 低 |
| modules/cobuild.py | 宿主 modules 调查 | 宿主业务功能 | 新建 plugins/cobuild/（含 backend.py 承接 /api/cobuild/*），或并入现有协作插件；归属待裁决 | 中 | ui/web/server.py | 中 |
| modules/ai_bridge.py | 宿主 modules 调查 | 宿主 AI 集成 | 保留为宿主能力；密钥文件不导出正文 | 中 | ui/web/server.py | 中 |
| modules/__init__.py | 宿主 modules 调查 | 宿主基础设施 | 保留 | 中 | Python 包 | 低 |
| 归档/ | 归档进度 | 归档目录状态 | 后续按 modules/plugins/ui/db 顺序决策后再归档，禁止提前整体搬入。 | 低 | file_navigation 后续轮次 |  |
| docs/appendix/files_manifest.json | 文档清单口径 | 文件预览清单一致性校验 | 保持 181 主目录文件 + 24 个非敏感归档文件 = 202 条清单；敏感 3 条不导出。 | 低 | plugins/bg_library/file_preview.py 的扫描规则 | 低 |
| tests/smoke_pdf.py | 测试 | PDF 插件冒烟测试 | 保留为 PDF 插件回归测试，不归入白皮书第六节解耦红线。 | 低 | tests/smoke_pdf.py | 中 |
| modules/visual_settings.py | 宿主模块 / SQL 访问 | 业务残留（共享 SQL 访问） | 按白皮书下沉到对应插件（如 plugins/pixel_art/ 或独立 visual 插件），保留兼容导出后再移除宿主实现。 | 中 | modules/pixel_art.py 直接引用；plugins/book_reader/book_reader.py 经 pixel_art 间接引用。 | 中 |
| tests/smoke_plugin_module_off.py | 新增/补齐 | 冒烟测试/插件解耦红线。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 测试 | 中 |
| tests/smoke_plugin_decoupling.py | 新增/补齐 | 冒烟测试/插件解耦红线。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 测试 | 中 |
| tests/smoke_plugin_data_dirs.py | 新增/补齐 | 冒烟测试/插件解耦红线。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 测试 | 中 |
| tests/smoke_pdf.py | 新增/补齐 | 冒烟测试/插件解耦红线。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 测试 | 中 |
| plugins/urlarch/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/urlarch/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/urlarch/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/urlarch/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/urlarch/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/sim/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/screeps/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/screeps/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/screeps/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/screeps/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/screeps/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/schedule/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/schedule/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/schedule/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/schedule/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/schedule/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/russian/srs.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/russian/seed.py | 新增/补齐 | 插件首次建库种子数据。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库初始化 | 中 |
| plugins/russian/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/russian/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/russian/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/russian/planner.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/russian/models.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/russian/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/russian/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/russian/importer.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/russian/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/russian/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/russian/__init__.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/rivet/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/promptgen/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/promptgen/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/promptgen/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/promptgen/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/promptgen/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/promptgen/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/promptgen/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/promptgen/__init__.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/project_manager/seed.py | 新增/补齐 | 插件首次建库种子数据。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库初始化 | 中 |
| plugins/project_manager/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/project_manager/pm_service.py | 新增/补齐 | 项目管理数据访问/服务层。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件业务 | 中 |
| plugins/project_manager/pm_repository.py | 新增/补齐 | 项目管理数据访问/服务层。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件业务 | 中 |
| plugins/project_manager/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/project_manager/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/project_manager/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/project_manager/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/project_manager/__init__.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/pixel_art/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/pixel_art/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/pixel_art/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/pdf/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/netexp/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/model_usage/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/model_usage/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/model_usage/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/model_usage/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/finance/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/finance/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/finance/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/finance/migrate_localstorage.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/filejudge/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/expdata/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/book_reader/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/book_reader/reader_screen.js | 新增/补齐 | 书籍阅读器屏幕渲染模块。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/book_reader/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/book_reader/migrate.py | 新增/补齐 | 插件旧表迁移脚本，兼容历史 schema。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 数据库迁移 | 高 |
| plugins/book_reader/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/book_reader/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/book_reader/bookmarks_repo.py | 新增/补齐 | 书籍书签 SQL 访问层。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 中 |
| plugins/book_reader/book_reader.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/book_reader/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/book_reader/__init__.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/bg_library/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/bg_library/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/bg_library/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/bg_library/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/bg_library/file_preview.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/bg_library/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/bg_library/bg_library.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/bg_library/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/bg_library/__init__.py | 新增/补齐 | 项目文件。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 工程 | 低 |
| plugins/aidebug/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/aidebug/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/aidebug/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/aidebug/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/aidebug/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/aidebug/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| plugins/ai/schema.sql | 新增/补齐 | 插件业务表 DDL，由 manifest.db.schema 在启动时执行。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 建表 | 高 |
| plugins/ai/repo.py | 新增/补齐 | 插件 SQL 访问层，集中业务表读写。 | 保留并纳入当前插件/测试/文档结构。 | 低 | SQLite 访问 | 高 |
| plugins/ai/plugin.css | 新增/补齐 | 插件专属样式，避免污染宿主 app.css。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件样式 | 低 |
| plugins/ai/manifest.json | 新增/补齐 | 插件清单，声明 entries/backend/db/style 与 data_dirs。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件加载 | 低 |
| plugins/ai/feature.js | 新增/补齐 | 插件前端，注册 window.__toolRenderers 并按需加载。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件 UI | 中 |
| plugins/ai/backend.py | 新增/补齐 | 插件后端，处理 /api/plugin/<id>/* 分发。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 插件后端 API | 中 |
| modules/visual_settings.py | 新增/补齐 | 宿主共享能力模块。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 宿主模块 | 中 |
| docs/plugin-development-whitepaper.md | 新增/补齐 | 项目文档。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 文档 | 低 |
| data/user_preferences.json | 新增/补齐 | 本地运行时数据或配置；不在此清单导出正文。 | 保留并纳入当前插件/测试/文档结构。 | 低 | 运行时数据 | 中 |
| webchat_probe.py | 拓展项 | Playwright 最小验证脚本：持久化 profile 打开 DeepSeek 会话、发送消息、等待回复并打印。 | 保留原位；标注为验证脚本，非运行必需；后续可迁 tools/。 | 部分：正式网页会话通道为 modules/web_chat.py；本脚本仅人工验证。 | 不被运行入口调用；依赖 playwright、webchat_profile/、DeepSeek 登录态与网络；不调用项目 Python 模块。 | 中：含示例会话 URL 与固定 profile 目录，依赖外部页面结构和登录态。 |
| config.py | 拓展项 | 全局配置常量：BASE_DIR/DATA_DIR/DB_PATH、SRS 间隔、配额、卡片规则、字体、默认主题、共建日志路径。 | 保留；不迁移。 | 无：项目约定新参数统一放此。 | 被 main.py、db/connection.py、core/*、ui/*、modules/* 读取；仅依赖 pathlib。 | 中：路径/配额/卡片规则变化会影响学习行为；PLAYWRIGHT_BROWSERS_DIR 仅默认值，可被 settings 覆盖。 |
| main.py | 功能项 | 启动入口：bootstrap 初始化数据库/首次播种，分发 --cli、--gui、默认 Web。 | 保留。 | 无：启动入口不可替代。 | 调用 config、core.repository、db.connection、modules.seed、ui.cli、ui.gui、ui.web.server。 | 低：init_db 失败会 SystemExit；Web 启动异常回退 GUI。 |
| README.md | 功能项 | 项目主说明：定位、真实依赖、三入口、目录职责、功能、数据/备份、风险、共建与开发约定。 | 保留并随实现更新。 | 无：项目主文档。 | 面向用户与接手 AI；内容人工维护，不参与运行。 | 低：说明可能滞后；已避免引用临时备份目录。 |
| tools/启动旅行之木.cmd | 功能项 | Windows 一键启动：切到脚本上一级（项目根），优先 pythonw，缺失回退 python 并提示。 | 保留。 | 部分：可直接运行 python main.py。 | 调用 Windows cmd、PATH 中的 pythonw/python 与 main.py。 | 低：缺少 Python 时明确失败。 |
| docs/appendix/file_navigation.json | 拓展项 | 文件导航主数据源：待办与已决定去留，含第二批 core/db/tests 审查摘要。 | 保留；后续轮次继续追加。 | 无：唯一结构化主数据源。 | 供人/AI 读取；docs/appendix/file_navigation.md 由它生成；不参与运行时逻辑。 | 低：需与 docs/appendix/file_navigation.md 同步，避免手工漂移。 |
| docs/appendix/file_navigation.md | 拓展项 | 文件导航只读摘要：待办、已决定、第二批审查表。 | 保留；仅通过生成脚本更新。 | 无：面向快速浏览。 | 由 docs/appendix/file_navigation.json 生成；不参与运行时逻辑。 | 低：手工修改会与 JSON 漂移。 |
| docs/appendix/files_manifest.json | 拓展项 | 文件预览导出清单：全部可见文件的相对路径、说明字段与归属节点。 | 保留；文件变化后重新导出。 | 无：现有前端导出的标准产物。 | 由 /api/files/state 的前端逻辑生成；不参与运行时逻辑。 | 低：说明来自 file_notes.details 标签文本，手工改写可能导致字段缺失。 |
| core/__init__.py | 拓展项 | 标记 core 为 Python 包，保持空实现以避免导入副作用。 | 保留。 | 无：可用命名空间包替代，但会改变导入约定。 | 被 from core import ... 隐式加载；不调用其他模块。 | 低：加入导入语句可能引入循环依赖或启动副作用。 |
| core/models.py | 数据项 | 定义 Item 与 ItemStat 两个 dataclass，承载学习条目与记忆状态字段。 | 保留。 | 部分：可用 dict/sqlite3.Row 传递，但会丢失类型提示与字段边界。 | 被 core.repository、modules.importer、modules.seed、ui.cli、ui.gui、ui.web.server 使用；不调用其他模块。 | 低：字段与 schema 需人工同步，当前无自动校验。 |
| core/planner.py | 功能项 | 按配额与权重挑选今日新学条目，组装到期复习计划。 | 保留。 | 无：计划规则唯一实现。 | 被 ui.cli、ui.gui、ui.web.server 调用；调用 core.repository 与 config。 | 中：分配循环最多 200 次，配额极大或可用数异常时可能分配不足；依赖 repository 查询性能。 |
| core/repository.py | 数据项 | 数据访问层：items/item_stats/review_logs/themes/model_usage_logs/file_notes/db_rules 的 SQL 封装。 | 保留；后续可评估按领域拆分，但需保持 SQL 集中约定。 | 无：SQL 集中约定。 | 被 main、cli、gui、server、modules.* 调用；调用 db.connection、core.models、core.srs、config。 | 中：单文件 676 行且承担多领域 SQL；跨表事务与主题类型归并逻辑需回归测试。 |
| core/srs.py | 功能项 | SRS 规则层：档位常量、间隔、下次复习日期、升降档与 A→LONG 阈值。 | 保留。 | 无：核心算法唯一实现。 | 被 core.repository 调用；读取 config.REVIEW_INTERVALS 与 A_GRADUATE_THRESHOLD。 | 低：非法档位会触发 KeyError；规则变更影响所有复习数据。 |
| db/__init__.py | 拓展项 | 标记 db 为 Python 包；空实现避免导入副作用。 | 保留。 | 无；可用命名空间包替代但会改变导入约定。 | 被 from db.connection import ... 隐式加载；不调用其他模块。 | 低：加入导入语句可能影响连接/迁移时机。 |
| db/connection.py | 数据项 | 线程本地连接与入口一次性 init_db；执行 schema.sql、幂等迁移与旧表快照。 | 保留；先修数据安全 bug，再按目标形态模块化。 | 无；连接与迁移入口唯一实现。 | 被 main.py、core/repository.py、modules.*、ui/web/server.py 调用；调用 config 与 db/schema.sql，并反向 import modules.pm_templates。 | 高：无条件 UPDATE 会清空 prompt_template；DDL 三处重复；db→modules 分层倒置。 |
| db/schema.sql | 数据项 | SQLite 全量 DDL 与索引：核心学习表、pm_*、reader_*、bg_*、visual/pixel、model_usage_logs、file_notes/db_rules。 | 保留并作为单一 DDL 源候选；后续按模块拆分。 | 无；建表契约唯一来源，但当前与 _migrate 重复。 | 被 db/connection.init_db 通过 executescript 执行；不调用其他模块。 | 高：集中 DDL 与迁移重复，改动易漂移。 |
| tests/smoke_books.py | 功能项 | 书籍阅读 API 端到端冒烟：建书、章节、导入与非法占位、清洗回填、词库来源、复制与删除。 | 保留。 | 无：阅读链路唯一冒烟。 | 手工运行；启动 ui.web.server，调用 reader API；使用临时 config.DB_PATH。 | 中：固定端口 8897，与 smoke_reader_range 冲突，不能并行；依赖 tokenizer/标记语义。 |
| tests/smoke_file_preview.py | 功能项 | 文件预览后端冒烟：真实工作区扫描、排除规则、file_notes/db_rules 增改删、路径越界拒绝。 | 保留。 | 无：file_notes/db_rules 唯一冒烟。 | 手工运行；直接调用 modules.file_preview 与 db.connection.init_db，使用临时库。 | 中：扫描真实工作区，文件数量/命名变化会影响断言；需保证 data/russian_tutor.db 存在。 |
| tests/smoke_model_usage.py | 功能项 | 模型用量与消费 API 冒烟：四 token、总 token、峰谷/节假日、价目增改删、编辑删除与错误输入。 | 保留。 | 无：模型用量链路唯一冒烟。 | 手工运行；启动 ui.web.server，调用 /api/model-usage*；使用临时库与 settings.json。 | 中：固定端口 8899，与 smoke_pm 冲突；依赖北京时间峰谷与内置价目常量。 |
| tests/smoke_pm.py | 功能项 | 项目管理器 API 与前端静态断言：六阶段、手填提示词、结果快照、格式面板、删除级联。 | 保留。 | 无：PM 链路唯一冒烟。 | 手工运行；启动 ui.web.server，调用 /api/pm/* 并读取 features/project_manager.js。 | 中：固定端口 8899，与 smoke_model_usage 冲突；大量源码字符串断言，前端文案改动易误报。 |
| tests/smoke_reader_range.py | 功能项 | 待清洗起止范围、任务范围列、分组下载 settings 读写与前端接入断言。 | 保留。 | 无：范围任务与 download_groups 唯一冒烟。 | 手工运行；启动 ui.web.server，调用 reader 与 settings API；使用临时库。 | 中：固定端口 8897，与 smoke_books 冲突；依赖 pending 顺序与静态文案。 |
| tests/smoke_startup_once.py | 功能项 | 启动初始化冒烟：schema/migrate 只执行一次、get_conn 不重复初始化、多请求不重复 DDL、迁移失败不监听。 | 保留。 | 无：启动幂等与失败路径唯一冒烟。 | 手工运行；monkeypatch db.connection 与 ui.web.server；使用临时库。 | 中：直接替换模块全局函数与 _initialized，测试顺序/异常可能污染进程；固定端口。 |
| tests/smoke_web.py | 功能项 | Web 综合冒烟：健康、学习条目/导入/主题/计划/复习、设置、共建打卡、阅读屏、背景库 new/update、静态资源与 TTS。 | 保留；涉及 API/设置变更时优先跑。 | 无：Web 主链路覆盖最广。 | 手工运行；启动 ui.web.server 并调用大量 API；使用临时库与临时共建日志。 | 中：固定端口 8898；/api/tts 依赖网络与 edge-tts，网络异常会记 FAIL 但不阻断后续断言；覆盖广但断言偏粗。 |
| data/ai_cobuild.json | 数据项 | 多 AI 共建打卡主数据源；当前 49 条记录；自动镜像 docs/多AI共建日志.md。 | 保留；只追加/作废，不手改。 | 无；Markdown 镜像不能替代主数据源。 | modules/cobuild.py 读取/追加；首页共建卡片、CLI cobuild、交接审计使用。 | 中：审计数据，手改会被镜像覆盖；备份需与 docs 同步。 |
| data/ai_keys.json | 数据项 | AI 工作台 API Key 与模型名配置；当前键名 kimi/kimi_model/doubao/doubao_model；本轮只读键名与类型，未回显值。 | 保留但提升密钥管理；文件预览排除，禁止导出/写入 manifest。 | 部分；可迁移到环境变量或系统密钥库，但需改 modules/ai_bridge.py。 | modules/ai_bridge.py 读取/写入；AI 工作台多平台 API 对话使用。 | 高：明文密钥；任何值不得进入 file_notes/navigation/manifest/回复。 |
| data/doubao_archive.json | 数据项 | 豆包 UIA 历史问答归档；当前 20 条，字段 hash/time/question_time/question/cost/reply。 | 保留历史；确认不再展示后再评估归档策略，不静默删除。 | 部分；doubao_history 有消息流但归档结构独立。 | modules/doubao_watch.py 的 _load_archive/_save_archive/_archive_reply；归档展示已移除但底层保留。 | 高：含对话正文，敏感本地数据。 |
| data/doubao_history.json | 数据项 | 豆包 UIA 消息历史与去重基线；当前 messages 530 条、baseline 20 条。 | 保留；与 archive 明确边界，避免重复增长。 | 部分；archive 有归档问答但历史消息流不等价。 | modules/doubao_watch.py 的 _load_history/_save_history；监听状态、去重、历史重置使用。 | 高：含对话正文与时间信息。 |
| data/filejudge_keep.json | 数据项 | 文件判官「已保留」路径清单；当前 81 条。 | 保留；路径失配时提示重扫，不自动删除。 | 无；可由用户重新逐项决定，但会丢失现决定。 | modules/file_judge.py 读取；文件判官扫描/删除确认使用。 | 中：记录本地路径，含目录隐私；文件移动后失效。 |
| data/fund_list_cache.json | 数据项 | 基金代码/名称/类型列表缓存；当前 27995 条，字段 code/name/type。 | 保留为可重建缓存；后续可加更新时间/版本。 | 有；可从数据源重新拉取，依赖网络与上游。 | modules/fund_nav.py 读取；理财量化基金搜索/净值查询使用。 | 中：约 2.5MB，可能过期；只读结构未读具体条目。 |
| data/rivet.json | 数据项 | 铆钉点习惯数据；当前 2 个 habit，含 records 等字段。 | 保留；备份时与 DB 一起保存；后续补版本/迁移说明。 | 无；用户习惯与打卡记录。 | modules/rivet.py 读取/写入；铆钉点工具、打卡统计使用。 | 中：用户数据；无 schema 版本。 |
| data/russian_tutor.db | 数据项 | 主 SQLite 数据库；只读审计 46 张表（含历史备份表）、23 items、23 item_stats、2 review_logs、2 themes、83 bg_nodes、24 file_notes、30 model_usage_logs、106 reader_words、149 reader_sentences、673 reader_cleaning_records 等。 | 保留；T2 目标形态与备份/迁移专项优先；不要让 file_preview 扫描内容。 | 无；业务主数据。 | db/connection.py、core/repository.py、所有业务模块与前端 API；覆盖学习、阅读、背景库、文件说明、模型用量。 | 高：单文件承载全部业务数据；审计只读打开并 PRAGMA query_only=ON，未执行业务写操作。 |
| data/settings.json | 数据项 | 运行时设置；当前 6 个顶层键：ru_family、ru_size、new_quota、review_quota、model_pricing、download_groups。 | 保留；共享写入需原子/备份，避免互相覆盖键。 | 部分；config.py 默认值与 visual_settings 可替代部分，但用户覆盖需此文件。 | modules/settings_store.py、modules/model_usage.py、modules/web_chat.py、modules/godot_bridge.py、ui/gui.py 读写。 | 中：多工具共享；本轮只读键结构，未改 settings.json。 |
| data/webchat_sessions.json | 数据项 | 网页会话链接列表；当前 1 条，字段 id/name/url/ts。 | 保留；URL 属本地敏感信息，不导出到 manifest。 | 部分；可手工重新添加会话，但会丢失名称/时间。 | modules/web_chat.py 读取/写入；网页会话通道列表、发送、登录复用。 | 中：含会话链接；本轮只读结构与数量，不回显 URL。 |
| modules/__init__.py | 拓展项 | 标记 modules 为 Python 包；空实现避免导入副作用。 | 保留 | 无；可用命名空间包替代但会改变导入约定。 | 被 from modules import ... 隐式加载；不调用其他模块。 | 低：引入业务导入可能造成循环依赖/启动副作用。 |
| modules/ai_bridge.py | 功能项 | 多平台 OpenAI 兼容对话、Key/模型状态与保存。 | 保留；后续规范化密钥与错误边界 | 部分；可直接 HTTP 调用，但缺统一封装。 | ui/web/server.py 的 /api/ai/*；AI 工作台前端；读写本机 Key 配置。 | 高：Key 明文、超时 300s；未回显 Key 值。 |
| modules/bg_library.py | 功能项 | 背景库核心：树、导入/导出、手动变更、删除、历史与 API。 | 保留；后续规范化（1596 行） | 无；背景库主实现。 | server.py、cli.py、file_preview.py；直接 get_conn。 | 中：体量大、SQL 与业务同文件、导入/删除复杂。 |
| modules/book_reader.py | 功能项 | 书籍阅读/标注/清洗/词库/导出/阅读屏 API。 | 保留；后续规范化（1104 行） | 无；阅读域主实现。 | server.py 的 reader/books API；使用 pixel_art。 | 高：数据结构与清洗一致性复杂。 |
| modules/cobuild.py | 功能项 | 多 AI 共建声明与打卡 JSON/镜像。 | 保留 | 部分；手工编辑 JSON 会失去原子/镜像。 | cli.py、server.py；data/ai_cobuild.json 与 docs 日志。 | 中：镜像自动重写，手改被覆盖。 |
| modules/crawler.py | 功能项 | 网页抓取/纯文本摘要。 | 保留；后续规范化 URL/超时/错误文案 | 部分；手工浏览可替代，缺统一截断。 | server.py /api/crawl；urllib。 | 中：任意 http(s) URL、错误含 URL 片段。 |
| modules/doubao_watch.py | 功能项 | 豆包 UIA 监听、状态/消息解析、归档/历史。 | 保留；后续规范化可选依赖与 COM 线程 | 部分；手工复制可替代，缺自动解析。 | server.py /api/doubao/*；Windows UIAutomation（可选）。 | 高：UIA 可选依赖、桌面结构敏感。 |
| modules/file_judge.py | 功能项 | 文件判官原后端；已迁 plugins/filejudge/backend.py。 | 删除；旧 route 已删，历史见备份。 | 无（迁移后由插件 backend 替代）。 | 旧 /api/filejudge/*；现 /api/plugin/filejudge/*。 | 高：delete 无路径白名单；备份保留。 |
| modules/file_preview.py | 功能项 | 工作区扫描/排除、DB 识别、file_notes/db_rules、API。 | 保留；后续规范化扫描缓存 | 无；文件说明/规则唯一后端。 | server.py、smoke_file_preview.py；使用 bg_library。 | 中：全工作区扫描、文件多时慢。 |
| modules/fund_nav.py | 功能项 | 基金列表与历史净值，24h 缓存。 | 保留；后续规范化网络错误/缓存版本 | 部分；手工查数据源。 | server.py 基金接口；data/fund_cache。 | 中：上游网络与页面结构。 |
| modules/godot_bridge.py | 拓展项 | Godot 工程扫描/动画帧导出。 | 保留；后续规范化外部进程/依赖 | 部分；手工导出 PNG/JSON。 | server.py /api/godot/*；Godot/Pillow（可选）。 | 中：外部 Godot/Pillow、临时文件。 |
| modules/importer.py | 功能项 | Markdown/管道/JSON 批量导入解析。 | 保留；后续规范化格式边界 | 部分；手工逐条录入。 | cli/gui/server 导入入口；core.models。 | 中：分隔符/类型归一化误判。 |
| modules/model_usage.py | 功能项 | 模型用量、价目/节假日、峰谷与花销 CRUD。 | 保留；后续规范化价目/错误边界 | 部分；表格手工记账。 | server.py /api/model-usage*；settings_store。 | 中：峰谷/币种规则复杂。 |
| modules/pdf_tools.py | 功能项 | PDF/批量压缩原后端；已迁 plugins/pdf/backend.py。 | 删除；旧 route 已删，历史见备份。 | 无（迁移后由插件 backend 替代）。 | 旧 /api/pdf/*、/api/batch/*；现 /api/plugin/pdf/*。 | 高：批量压缩原位覆盖文件；备份保留。 |
| modules/pixel_art.py | 功能项 | 像素画作品/视觉设置/资产引用。 | 保留；后续规范化大 JSON 校验 | 无；像素画存储主实现。 | server.py、book_reader.py；db.connection。 | 中：pixels/palette 体积大、直接 SQL。 |
| modules/pm_repository.py | 数据项 | PM 模板/项目/阶段/草稿/结果 SQL 层。 | 保留；后续规范化事务/索引 | 无；PM 数据访问唯一实现。 | pm_service.py；db.connection。 | 中：SQL 与业务表耦合。 |
| modules/pm_service.py | 功能项 | PM 六阶段、提示词、结果快照/上下文/导出。 | 保留；后续规范化错误类型 | 无；PM 业务唯一实现。 | server.py /api/pm/*；pm_repository。 | 中：上下文/阶段/删除语义复杂。 |
| modules/pm_templates.py | 数据项 | PM 六阶段空壳模板与幂等种子。 | 保留；后续解 db→modules 反向依赖 | 部分；可由迁移/管理端初始数据替代。 | db/connection.py::_migrate。 | 低：与迁移边界需整理。 |
| modules/rivet.py | 功能项 | 铆钉点原后端；已迁 plugins/rivet/backend.py。 | 删除；旧 route 已删，历史见备份。 | 无（迁移后由插件 backend 替代）。 | 旧 /api/rivet/*；现 /api/plugin/rivet/*。 | 低（备份保留；数据文件未删）。 |
| modules/seed.py | 数据项 | 7 主题 + 32 条种子，首次/空库导入，按俄语去重。 | 保留；后续规范化种子类型/版本 | 部分；可手工补种，缺幂等初始集。 | main.py、cli.py、server.py；core.repository。 | 低：主题类型可能覆盖条目类型。 |
| modules/settings_store.py | 数据项 | settings.json 锁/原子写/浅合并。 | 保留；后续规范化键校验/备份 | 部分；直接读写缺原子/串行。 | model_usage.py、web_chat.py、server.py。 | 中：多工具共享、浅合并覆盖风险。 |
| modules/tts.py | 功能项 | 后台朗读、缓存、edge-tts、系统播放/清理。 | 保留；后续规范化依赖缺失提示 | 部分；外部 TTS 可替代。 | gui.py、server.py /api/tts；edge-tts（可选）。 | 中：网络/外部命令、失败静默。 |
| modules/web_chat.py | 功能项 | Playwright 常驻浏览器、登录、发送/取回复、会话列表。 | 保留；后续规范化选择器/超时 | 部分；官方 API 可替代，缺网页登录态。 | server.py /api/webchat/*；settings_store、data 下会话文件。 | 高：Playwright/登录态/页面改版；未回显链接/登录态路径。 |
| webchat_profile/ | 数据项 | Playwright 持久化 Chromium profile，保存网页会话登录态、站点存储、缓存与运行期元数据。 | 保留；仅运行期使用，禁止提交/导出/进入 manifest。 | 无；登录态无法由普通文件重建，只能重新扫码登录。 | 由 modules/web_chat.py 的 Playwright 持久化上下文使用；不进入业务 API。 | 高：Cookie/Login Data/Local Storage/Preferences 等含敏感登录态；未读取值。 |
| ui/__init__.py | 拓展项 | ui 包初始化，空实现。 | 保留 | 无；命名空间包可替代但会改变导入约定。 | 被 from ui import ... 隐式加载。 | 低：引入导入可能产生副作用。 |
| ui/cli.py | 功能项 | CLI 入口与 9 个子命令分发。 | 保留；后续规范化参数/错误文案 | 部分；可直接调用 repository，但缺统一帮助/参数。 | main.py --cli；core.repository、modules.seed/importer/cobuild/bg_library。 | 中：命令与业务耦合，输出可能含数据。 |
| ui/gui.py | 功能项 | 经典 Tkinter 入口，8 页 notebook。 | 保留；后续与 Web 共享规则 | 部分；Web 覆盖同类学习，但 GUI 不依赖浏览器。 | tkinter、core.repository/planner、modules.importer/tts。 | 中：89KB 单文件，GUI/Web 规则重复。 |
| ui/web/server.py | 功能项 | 本地 Web 服务；P1 增加插件清单/静态映射。 | 保留；后续路由表化/请求上限。 | 无。 | app.js、plugins/、所有 API。 | 高：无鉴权/限流/体积上限。 |
| ui/web/static/index.html | 功能项 | Web 单页外壳。 | 保留；无框架/无构建 | 无；前端入口。 | app.css/app.js。 | 低：静态壳。 |
| ui/web/static/app.js | 功能项 | 前端外壳/工具架子；内置 12 + 插件 9（10 entry）。 | 保留；继续迁移。 | 无。 | app.js/plugins/*/feature.js。 | 中：单文件大、共享状态多。 |
| ui/web/static/app.css | 功能项 | 全站样式/主题/组件样式。 | 保留；后续样式分层 | 部分；默认样式可替代但失去主题/布局。 | index/app.js、各 feature 类名。 | 中：155KB 单文件。 |
| ui/web/static/favicon.ico | 拓展项 | ICO 标签图标。 | 保留 | 有；可用 PNG/默认图标。 | 无 | 低。 |
| ui/web/static/favicon.png | 拓展项 | PNG 标签图标。 | 保留 | 有；可用 ICO/默认图标。 | 无 | 低。 |
| ui/web/static/features/ai.js | 功能项 | AI 工作台多平台对话前端。 | 保留；统一错误/状态 | 部分；可直接调 API，缺统一 UI。 | /api/ai/*、/api/webchat/*；全局 UI。 | 高：Key 状态；不展开值。 |
| ui/web/static/features/aidebug.js | 功能项 | 接口调试器/网页 DS 原文抓取。 | 保留；统一解析/错误 | 部分；手工调接口，缺解析 UI。 | /api/doubao/*、window.__webchat；全局 UI。 | 中：页面/会话内容敏感。 |
| ui/web/static/features/batch.js | 功能项 | PDF/批量压缩原前端；已迁 plugins/pdf/。 | 删除；交互与下载流程原样保留。 | 无（迁移后由插件 feature 替代）。 | app.js 按 entry 动态 import。 | 高：批量压缩原位覆盖文件。 |
| ui/web/static/features/bg_library.js | 功能项 | 背景库+文件预览前端。 | 保留；文件树/工具函数整理 | 无；唯一前端。 | /api/bg/*、/api/files/*；全局 UI。 | 中：76KB、状态多。 |
| ui/web/static/features/book_reader.js | 功能项 | 书籍阅读/标注/清洗/词库/阅读屏入口。 | 保留；与 reader_screen 共享规则 | 无；阅读主前端。 | /api/books、/api/reader/*；reader_screen.js。 | 高：数据/清洗复杂。 |
| ui/web/static/features/expdata.js | 功能项 | 实验数据获取原内置前端；已迁移为 plugins/expdata/feature.js。 | 迁移后删除原件；保留备份。 | 无；迁移后由插件 feature.js 替代。 | 原 app.js TOOLS/TOOL_FEATURE_FILES；现由 /api/plugins/list + 动态 import。 | 低：原样迁移，未改功能。 |
| ui/web/static/features/filejudge.js | 功能项 | 文件判官原前端；已迁 plugins/filejudge/feature.js。 | 删除；四视图交互原样保留。 | 无（迁移后由插件 feature 替代）。 | app.js 动态 import /plugins/filejudge/feature.js。 | 高：删除按钮仍直接触发后端 unlink。 |
| ui/web/static/features/finance.js | 功能项 | 记账本+理财量化前端。 | 保留；拆分/共享图表 helper | 无；记账/理财主前端。 | /api/ai、/api/fund、/api/crawl、/api/webchat；localStorage；Canvas。 | 高：463KB、金额/归因复杂。 |
| ui/web/static/features/model_usage.js | 功能项 | 模型用量/价目/趋势前端。 | 保留；表单/错误统一 | 部分；表格手工统计。 | /api/model-usage*；全局 UI。 | 中：金额/峰谷计算。 |
| ui/web/static/features/pdf.js | 功能项 | PDF/批量压缩原前端；已迁 plugins/pdf/。 | 删除；交互与下载流程原样保留。 | 无（迁移后由插件 feature 替代）。 | app.js 按 entry 动态 import。 | 高：批量压缩原位覆盖文件。 |
| ui/web/static/features/pixel.js | 功能项 | 像素动画/Godot 导入/收纳架前端。 | 保留；与 pixel_art 共享模型 | 部分；手工导出动画。 | /api/godot/*；localStorage；Canvas。 | 中：动画/localStorage 体积。 |
| ui/web/static/features/pixel_art.js | 功能项 | 像素画布/作品库/资产引用前端。 | 保留；大 JSON 校验 | 无；像素画主前端。 | /api/pixel/*；Canvas；DB。 | 中：pixels/palette 体积。 |
| ui/web/static/features/project_manager.js | 功能项 | PM 六阶段/提示词/结果/上下文前端。 | 保留；与 PM service 错误统一 | 无；PM 主前端。 | /api/pm/*；全局 UI。 | 中：阶段/结果状态复杂。 |
| ui/web/static/features/promptgen.js | 功能项 | 提示词生成器四界面前端。 | 保留；拆分 175KB 单文件 | 无；提示词生成主前端。 | /api/bg/export、/api/books、/api/reader/*、__webchat；localStorage。 | 高：175KB、状态多。 |
| ui/web/static/features/reader_screen.js | 功能项 | 书籍阅读内部全屏阅读屏（三阅读层级/遮挡/高亮/折叠）。 | 保留；与 book_reader 共享状态 | 部分；书内层级视图可替代部分。 | /api/books/*、/api/reader/*；localStorage 键类别。 | 中：会话状态/书签键分离；无独立首页入口。 |
| ui/web/static/features/rivet.js | 功能项 | 铆钉点原前端；已迁 plugins/rivet/feature.js。 | 删除；交互与统计展示原样保留。 | 无（迁移后由插件 feature 替代）。 | app.js 动态 import /plugins/rivet/feature.js。 | 低（备份保留）。 |
| ui/web/static/features/russian.js | 功能项 | 俄语单词背诵 hub：闪卡/计划/复习/导入/知识库/统计 8 视图。 | 保留；拆分子模块 | 无；学习主前端。 | /api/items、/plan、/review、/stats、/settings。 | 中：48KB 单文件。 |
| ui/web/static/features/schedule.js | 功能项 | 计划表原内置前端；已迁移为 plugins/schedule/feature.js。 | 迁移后删除原件；保留备份。 | 无；迁移后由插件 feature.js 替代。 | 原 app.js TOOLS/TOOL_FEATURE_FILES；现由 /api/plugins/list + 动态 import。 | 低：原样迁移，未改功能。 |
| ui/web/static/features/screeps.js | 功能项 | Screeps Arena 原内置前端；已迁移为 plugins/screeps/feature.js。 | 迁移后删除原件；保留备份。 | 无；迁移后由插件 feature.js 替代。 | 原 app.js TOOLS/TOOL_FEATURE_FILES；现由 /api/plugins/list + 动态 import。 | 低：原样/拆分迁移，未改业务。 |
| ui/web/static/features/sim.js | 功能项 | 随机模拟器原内置前端；已迁移为 plugins/sim/feature.js。 | 迁移后删除原件；保留备份。 | 无；迁移后由插件 feature.js 替代。 | 原 app.js TOOLS/TOOL_FEATURE_FILES；现由 /api/plugins/list + 动态 import。 | 低：迁移未改逻辑；旧 rt_sim 保持。 |
| ui/web/static/features/webchat.js | 功能项 | 共享会话能力 getSession/chatPost/parseJSON。 | 保留；与 web_chat 前端整合 | 部分；直接调 API 但缺轮换。 | /api/webchat/*；localStorage 会话键类别。 | 高：会话链接敏感；不回显值。 |
| ui/web/static/features/webtools.js | 功能项 | 原 webtools 一个文件两个入口；已拆为 urlarch 与 netexp 两个独立插件。 | 迁移后删除原件；保留备份。 | 无；迁移后由插件 feature.js 替代。 | 原 app.js TOOLS/TOOL_FEATURE_FILES；现由 /api/plugins/list + 动态 import。 | 低：原样/拆分迁移，未改业务。 |
| docs/bg-update-bg-cli-md-download-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base/current 各 8 节点。 | 保留原位；建议归档 docs/archive/bg-updates/（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：含节点摘要/内部路径；不回显。 |
| docs/bg-update-book-vocab-rounds-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base/current 各 3 节点。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 低到中：含节点摘要；不回显。 |
| docs/bg-update-cleaning-task-nav-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base/current 各 7 节点。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 低到中：含节点摘要；不回显。 |
| docs/bg-update-flow-rewrite-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base 19/current 18/changed 4。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：base/current 有差异；不回显。 |
| docs/bg-update-internal-ref-home-download-2026-10-24.json | 数据项 | 2026-10-24 背景库 update 包；base 10/current 12/changed 10。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：含节点摘要/内部路径；不回显。 |
| docs/bg-update-pixel-art-ai-log-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base 8/current 10/changed 8。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：含节点摘要；不回显。 |
| docs/bg-update-promptgen-bg-readerscreen-2026-10-24.json | 数据项 | 2026-10-24 背景库 update 包；base/current 各 14 节点。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：含节点摘要；不回显。 |
| docs/bg-update-promptgen-groups-internal-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base/current 各 7 节点。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 低到中：含节点摘要；不回显。 |
| docs/bg-update-reader-vocab-sidebar-2026-10-24.json | 数据项 | 2026-10-24 背景库 update 包；base/current 各 9 节点。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 低到中：含节点摘要；不回显。 |
| docs/bg-update-tree-delete-2026-10-23.json | 数据项 | 2026-10-23 背景库 update 包；base 5/current 3/changed 3。 | 保留原位；建议归档（待确认） | 部分；bg_versions 有记录，原包为审计材料。 | modules/bg_library.py 的 update 导入；非运行期。 | 中：base/current 有差异；不回显。 |
| docs/ui_favicon.png | 拓展项 | 256×256 RGBA PNG 静态图标副本。 | 保留原位；建议归档或删除（待确认） | 有；可用 ui/web/static/favicon.* 或重新生成。 | 无运行期依赖；未发现运行期引用（需核实）。 | 低：静态图标。 |
| tools/bg_archive_stale.py | 拓展项 | 一次性运维脚本：把旧背景树非 deprecated 节点整体作废并打卡；默认演练，--apply 才写入。 | 保留并标注勿误跑 --apply；归档需确认 | 有；可手工逐节点作废，但缺批量/演练。 | modules.bg_library/cobuild；不调用网络；人工运维。 | 高：--apply 会作废当前活动树；未执行；不显示节点清单。 |
| plugins/sim/manifest.json | 数据项 | 随机模拟器插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | server.py /api/plugins/list；app.js 合并；file_preview。 | 低。 |
| plugins/sim/feature.js | 功能项 | 随机模拟器插件前端（原 sim.js 原样迁移）。 | 保留；迁移不改模型。 | 无；随机模拟器唯一实现。 | app.js 动态 import /plugins/sim/feature.js；Canvas/localStorage rt_sim。 | 中：Canvas/大量粒子。 |
| plugins/expdata/manifest.json | 数据项 | 实验数据获取插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | /api/plugins/list；app.js 合并；file_preview。 | 低。 |
| plugins/expdata/feature.js | 功能项 | 实验数据获取插件前端（原 expdata.js 原样迁移）。 | 保留；不改测量口径。 | 无；实验取点唯一实现。 | app.js 动态 import；Canvas/剪贴板；无 API。 | 中：仅内存。 |
| plugins/schedule/manifest.json | 数据项 | 计划表插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | /api/plugins/list；app.js 合并；file_preview。 | 低。 |
| plugins/schedule/feature.js | 功能项 | 计划表插件前端（原 schedule.js 原样迁移）。 | 保留；不改键名/迁移。 | 部分；外部日历可替代。 | localStorage 四键；全局 $/loadJSON。 | 中：localStorage/时间。 |
| plugins/screeps/manifest.json | 数据项 | Screeps Arena 插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | /api/plugins/list；app.js 合并。 | 低。 |
| plugins/screeps/feature.js | 功能项 | Screeps Arena 插件前端（原样迁移）。 | 保留；不改键名/逻辑。 | 无；唯一实现。 | localStorage sc_sas_workspace_v1；无 API。 | 中：大文件。 |
| plugins/urlarch/manifest.json | 数据项 | 网址归档插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | /api/plugins/list；app.js 合并。 | 低。 |
| plugins/urlarch/feature.js | 功能项 | 网址归档插件前端（从 webtools 拆出）。 | 保留；不改导出/间隔。 | 无；唯一实现。 | localStorage url_archive_v1；rtDownloadBlob。 | 中：弹窗拦截。 |
| plugins/netexp/manifest.json | 数据项 | 网络与互联探索插件清单。 | 保留；P1 schema。 | 无；插件注册元数据。 | /api/plugins/list；app.js 合并。 | 低。 |
| plugins/netexp/feature.js | 功能项 | 网络与互联探索占位前端（从 webtools 拆出）。 | 保留；未来只改此文件。 | 无；占位。 | 无 API/持久化。 | 低。 |
| tests/smoke_plugins.py | 功能项 | 插件层自动化断言：清单/静态资源/扫描容错/CSS 结论守卫。 | 保留；插件增删/CSS 变更后必跑。 | 无；原有 smoke_web 不覆盖插件。 | python tests/smoke_plugins.py；启动 ui.web.server；临时 PLUGINS_DIR 注入。 | 低：动态端口；node 缺失时跳过语法检查；CSS 阈值为硬编码，需随决策调整。 |
| ui/web/static/app.css（插件 CSS 残留） | 功能项 | 全站样式/主题/组件样式；含 6 个插件的专用样式。 | 保留；插件 CSS 不拆分，按决策文档阈值复核。 | 部分；默认样式可替代但失去主题/布局。 | index.html 单条 app.css；app.js/各 feature 类名；插件 feature 不加载 CSS。 | 中：155KB 单文件；专用残留增长到 12KB/8% 时 smoke_plugins.py 会失败，需重评。 |

## 说明

- 本文件由 `tools/gen_file_navigation_md.py` 从 `docs/appendix/file_navigation.json` 生成。
- 结构、历史记录和去留决定以 JSON 主数据源为准；本摘要不承载额外决定。
