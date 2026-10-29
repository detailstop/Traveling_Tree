# 文件导航清单（只读摘要）

> 只读摘要，勿手改。本文件由 file_navigation.json 生成；结构与去留决定以 JSON 为准。

- 生成时间：2026-10-29T22:24:17+03:00
- 轮次：64
- 待办：1 条；已决定：430 条

## 待办

| 路径 | 移动计划 | 指南计划 | 摘要 | 轮次 | 创建时间 |
| --- | --- | --- | --- | --- | --- |
| tests/smoke_plugin_decoupling.py::Server.start |  |  |  | 54 | 2026-10-29T19:48:41+03:00 |

## 已决定去留

| 路径 | 决定 | 原因 | 状态 | 轮次 | 时间 | 备份路径 |
| --- | --- | --- | --- | --- | --- | --- |
| file_navigation.json::public-scan-round64 | 公开前文案扫描结论（round 64） | 扫描 125 个代码/文档文件：必须清理 0 项；建议清理 1 项（plugins/pdf/feature_batch.js:25 示例路径含 WJL，建议替换为 <用户名>）；可接受 164 项（detailstop 3 处为仓库 owner；AI agent 名 161 处为多 AI 协作记录）。绝对路径 0、个人邮箱 0、手机号 0、具体地址 0、真实 token URL 0；money 15 与 sensitive_url 42 为代码/模板误报，不是个人财务值或真实凭据。docs/多AI共建日志.md 的 agent 名为 DSH、DeepSeek Harness、Codex · GPT-5（DeepSeek Harness 扮演），无真实姓名；适合公开。结论：无必须清理项，可考虑转 public；WJL 建议在公开前匿名化。 | done | 64 | 2026-10-29T22:24:17+03:00 |  |
| data/backup/::round61-63_temp | 清理 round 61–63 临时备份（round 64） | round59_docs_post_move（3 文件/304,546 B）、round60_rt_fin（4/119,341 B）、round61_clean_start（10/618,121 B）、round62_git_init（2/303,139 B）、round63_push（2/292,890 B）共 5 个临时目录已清理，释放 1,638,037 B。这些是 round 61–63 的改前快照，commit 均成功、工作区 clean，回滚价值归零。data/ 在 .gitignore，清理不产生 Git 变更；data/backup/ 现为空目录。历史 decided 中 backup_path 指向这些目录的记录保留为历史（路径已不存在）。 | done | 64 | 2026-10-29T22:24:17+03:00 |  |
| .git::remote | 配置远程仓库并 push（round 63，私有） | remote origin = https://github.com/detailstop/Traveling_Tree.git；本地 commit 9c63178（181 文件）+ c7ffd42（round 62 docs）；用户手动 push 成功，remote HEAD = c7ffd4209dcff0184be2727bc7608443c6a04b9c；agent 环境非交互，无法输入 PAT，故 push 由用户手动完成；PAT 存于 Windows 凭据管理器，后续 agent push 无需交互。 | done | 63 | 2026-10-29T22:17:12+03:00 | data/backup/round63_push/ |
| data/ai_cobuild.json::round61_two_checkins | round 61 两次打卡说明（保留，不作废） | round 61 阶段 6 完成后先打卡（#55，21:49），补完 README 后最终打卡（#56，21:53）。两条均为真实操作记录，内容不同，非重复提交；count 54→56 的 +2 由此解释。按只追加原则保留。 | done | 62 | 2026-10-29T21:59:19+03:00 |  |
| .git | 初始化 Git 仓库（round 62，私有） | git init -b main；首次 commit 哈希 9c63178；181 文件（Python 88 / JS 25 / Markdown 6 / 插件目录 141）；.gitignore 排除 data/、data_path.txt、rt_fin.json、webchat_profile/、__pycache__ 等；git status clean；git ls-tree 确认无敏感路径。远端：待 round 63。 round 63 已配置 remote https://github.com/detailstop/Traveling_Tree.git，用户手动 push 成功（agent 环境无法交互输入 PAT）；remote HEAD = c7ffd4209dcff0184be2727bc7608443c6a04b9c；main 跟踪 origin/main。认证方式：PAT 存于 Windows 凭据管理器。 | done | 62 | 2026-10-29T21:59:19+03:00 | data/backup/round62_git_init/ |
| README.md | round 61 补充数据目录与克隆说明 | 第 6 节加首次启动自动建库说明；第 7 节风险提示加 webchat_profile 克隆后为空需重新登录。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| .gitignore | 新建（round 61） | data/ 留在项目内本地用，.gitignore 排除 data/、rt_fin.json、__pycache__ 等。克隆项目后启动，config.py 自动建 data/，init_db 扫描 plugins/*/schema.sql 建表并播种；干净启动测试已通过。webchat_profile 被忽略，克隆者需重新扫码登录（README 已说明）。不创建 data_path.txt（data/ 不搬家）。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| file_navigation.json::工艺教训-round61 | SQLite 恢复后验证判据修正 | round 61 阶段 5.4 原设计要求恢复后 SHA256 与基线一致，但阶段 5.5 又要求启动服务验证，两者矛盾：SQLite 启动必改 header 元数据。后续同类任务改为：先 PRAGMA integrity_check + 表行数对比，再启动服务；SHA256 仅用于字节级备份完整性（如 rename 前后），不用于 SQLite 恢复判定。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| data/russian_tutor.db | round 61 启动验证后 SHA256 变化，完整性检查通过（接受当前 DB） | 阶段 5.4 用 SHA256 判定恢复失败，但 SQLite 启动会重写 header 元数据（change counter / schema cookie / checkpoint），字节哈希必然变。完整性检查：PRAGMA integrity_check=ok；83 表；items 23 / item_stats 23 / themes 2 / bg_nodes 81 / file_notes 165 / bg_versions 84 / finance_accounts 15 / finance_snapshots 28，均 >= round 28 基线；items ID 168-190 连续无空洞；page_count 2098 * page_size 4096 = 8,593,408 B 精确等于文件大小；freelist 3 页（0.14%）。无需从备份恢复。 | done | 61 | 2026-10-29T21:53:13+03:00 |  |
| tests/smoke_finance.py | 迁移测试输入路径同步 | INPUT 由 ROOT/plugins/finance/fixtures/rt_fin.json 改为 ROOT/data/plugins/finance/fixtures/rt_fin.json；smoke_finance 34/34。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/smoke_finance.py.bak |
| plugins/finance/migrate_localstorage.py | 迁移默认输入改插件数据目录 | INPUT 由 ROOT/plugins/finance/fixtures/rt_fin.json 改为 config.plugin_data_dir("finance")/fixtures/rt_fin.json；dry-run 可定位新文件，未执行 apply。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/migrate_localstorage.py.bak |
| plugins/finance/fixtures/rt_fin.json | 移出代码目录到 data/plugins/finance/fixtures/（数据隔离） | 含真实财务数据，属个人数据；同盘 rename 到 data/plugins/finance/fixtures/rt_fin.json，99,533 B，SHA256 0dac386c8ed81765324692d86f33562f6097d7cd9ff1d9d454cc12090238094e 前后一致；旧 fixtures/ 已空并删除。file_preview 的 EXCLUDE_FILE_GLOBS 含 rt_fin.json，按 basename 匹配，新路径继续排除。smoke_finance 34/34、smoke_file_preview 17/17；dry-run RC0 定位新路径。 | done | 60 | 2026-10-29T21:13:36+03:00 | data/backup/round60_rt_fin/ |
| file_navigation.json::historical_paths | 历史路径指针说明（round 59） | round 59 将 归档/ 与 data/backup/ 整体移出项目。decided 中 59 条 backup_path 以 data/backup/ 开头、11 条 new_path 以 归档/ 开头、3 条 path 为 归档/、48 条 reason/decision 正文提及这两路径，均为历史记录，路径已不存在，不再逐条修改。若需追溯，按 round 编号从项目外归档目录取回。 | done | 59 | 2026-10-29T21:03:37+03:00 |  |
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
| file_navigation.json::round41-stage4 | 报告表述修正（round 41） | round 41 报告阶段 4 段落误写“旧宿主业务键已删除”；实际 data/backup/round41_settings/settings.json 与 settings.after_split.json SHA256 完全相同（cbc616fe...），证明阶段 4 未删键，阶段 6 才删。流程合规，仅报告表述错位，状态不回滚。 | done | 42 | 2026-10-29T16:52:43+03:00 |  |
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
| files_manifest.json | 口径表述修正 | round 34 的“181 = 202 - 24 + 3”数学成立但语义易误读。round 35 排除归档后：主目录 manifest 条目 = 178；主目录实际文件 = 178 + 3（敏感：ai_keys.json、webchat_sessions.json、plugins/finance/fixtures/rt_fin.json）= 181。归档文件 24 个不计入 manifest。 | done | 35 | 2026-10-29T00:28:35+03:00 |  |
| 归档/ | 纳入文件预览（未命中排除规则） | file_preview 的 EXCLUDE_DIR_NAMES / EXCLUDE_REL_DIRS / EXCLUDE_FILE_GLOBS 不排除 归档/；已将 24 个非敏感归档文件加入 files_manifest，敏感归档文件不进入。 | done | 34 | 2026-10-29T00:23:13+03:00 |  |
| files_manifest.json | 口径校验 | 主目录实际文件 N=181；manifest M=202（含 归档/ 下 24 个非敏感文件）；主目录排除敏感 K=3（data/ai_keys.json、data/webchat_sessions.json、plugins/finance/fixtures/rt_fin.json）；181 = 202 - 24 + 3。归档/data/doubao_archive.json 与归档/data/doubao_history.json 属于敏感文件，未进入 manifest。 | reviewed | 34 | 2026-10-29T00:23:13+03:00 |  |
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
| 启动旅行之木.cmd | 保留 | Windows 便捷启动脚本，使用 %~dp0 与 PATH；保留并同步 file_notes。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| file_navigation.json | 追加第 24 轮决定记录 | 记录 prompt_template 修复、pixel 下线、插件路由表与两个插件迁移；pixel 动画历史 decided 条目标记删除，历史审计材料引用保留。 | updated | 11 | 2026-10-27T17:37:14+03:00 |  |
| file_navigation.md | 新建指南 | 由 file_navigation.json 生成的只读摘要，标注“只读摘要，勿手改”；与 JSON 同步。 | done | 11 | 2026-10-27T17:37:14+03:00 |  |
| files_manifest.json | 重导出文件预览清单 | 按文件预览导出能力重生成；清除已删动画/Godot 文件条目并纳入新插件与路由表。 | updated | 11 | 2026-10-27T17:37:14+03:00 |  |
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
| ui/web/static/features/russian.js | 审查完成·保留 | 第六批 ui 只读审查；旅行之木 hub：闪卡/计划/复习/导入/知识库/统计 8 视图。 建议：保留；拆分子模块 | reviewed | 16 | 2026-10-27T22:37:48+03:00 |  |
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
| tools/gen_file_navigation_md.py | 新增 file_navigation.md 生成器 | 标准库脚本以 file_navigation.json 为主数据源生成只读摘要；不得手改 Markdown。 | added | 24 | 2026-10-28T11:45:13+03:00 |  |
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
| files_manifest.json | 文档清单口径 | 文件预览清单一致性校验 | 保持 181 主目录文件 + 24 个非敏感归档文件 = 202 条清单；敏感 3 条不导出。 | 低 | plugins/bg_library/file_preview.py 的扫描规则 | 低 |
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
| 启动旅行之木.cmd | 功能项 | Windows 一键启动：切到脚本所在项目根，优先 pythonw，缺失回退 python 并提示。 | 保留。 | 部分：可直接运行 python main.py。 | 调用 Windows cmd、PATH 中的 pythonw/python 与 main.py。 | 低：缺少 Python 时明确失败。 |
| file_navigation.json | 拓展项 | 文件导航主数据源：待办与已决定去留，含第二批 core/db/tests 审查摘要。 | 保留；后续轮次继续追加。 | 无：唯一结构化主数据源。 | 供人/AI 读取；file_navigation.md 由它生成；不参与运行时逻辑。 | 低：需与 file_navigation.md 同步，避免手工漂移。 |
| file_navigation.md | 拓展项 | 文件导航只读摘要：待办、已决定、第二批审查表。 | 保留；仅通过生成脚本更新。 | 无：面向快速浏览。 | 由 file_navigation.json 生成；不参与运行时逻辑。 | 低：手工修改会与 JSON 漂移。 |
| files_manifest.json | 拓展项 | 文件预览导出清单：全部可见文件的相对路径、说明字段与归属节点。 | 保留；文件变化后重新导出。 | 无：现有前端导出的标准产物。 | 由 /api/files/state 的前端逻辑生成；不参与运行时逻辑。 | 低：说明来自 file_notes.details 标签文本，手工改写可能导致字段缺失。 |
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
| ui/web/static/features/russian.js | 功能项 | 旅行之木 hub：闪卡/计划/复习/导入/知识库/统计 8 视图。 | 保留；拆分子模块 | 无；学习主前端。 | /api/items、/plan、/review、/stats、/settings。 | 中：48KB 单文件。 |
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

- 本文件由 `tools/gen_file_navigation_md.py` 从 `file_navigation.json` 生成。
- 结构、历史记录和去留决定以 JSON 主数据源为准；本摘要不承载额外决定。
