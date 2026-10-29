"""
全局配置模块。

约定：
  - 所有可调参数集中于此，便于后续 AI 扩展时快速定位。
  - 修改配置不影响表结构；核心表同步 db/schema/*.sql，插件表放 plugins/<id>/schema.sql。
  - 任何新参数都应在此处添加默认值，禁止散落在业务代码中。
"""

from pathlib import Path

# ---------- 路径 ----------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "russian_tutor.db"


def plugin_data_dir(plugin_id: str) -> Path:
    """返回并确保 data/plugins/<plugin_id>/ 存在；所有插件私有文件都写这里。"""
    name = str(plugin_id or "").strip()
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        raise ValueError(f"非法插件数据目录名：{plugin_id!r}")
    path = DATA_DIR / "plugins" / name
    path.mkdir(parents=True, exist_ok=True)
    return path


# Playwright 浏览器二进制默认目录（相对项目根；可在 data/settings.json 的
# paths.playwright_browsers 覆盖，缺失时由 web_chat 报明确错误）
PLAYWRIGHT_BROWSERS_DIR = DATA_DIR / "playwright_browsers"

# ---------- 层次二：分档复习间隔（天） ----------
# A=熟、B=半熟、C=生、LONG=长期复习
REVIEW_INTERVALS = {
    "A": 7,
    "B": 3,
    "C": 1,
    "LONG": 30,
}

# A 档升入长期复习所需的连续通过次数
A_GRADUATE_THRESHOLD = 2

# ---------- 层次一：学习计划配额（可在「今日计划」页调整并持久化） ----------
DAILY_NEW_QUOTA = 18       # 每天新学知识总数
DAILY_REVIEW_QUOTA = 30    # 每天复习知识总数
# 新学总数在三种类型间的分配权重
NEW_TYPE_WEIGHTS = {"daily": 0.55, "term": 0.28, "pattern": 0.17}

# 中俄互译默认题量
TRANSLATION_QUOTA = 15

# ---------- 卡片显示规则（False=默认遮盖，点击后显示） ----------
CARD_SHOW_TRANSLATION = False   # 是否默认直接显示翻译
CARD_SHOW_EXAMPLE = False       # 是否默认直接显示示例

# 卡片俄语（句式）字体：可在「今日学习」页调整，并持久化到 data/settings.json
RUSSIAN_FONT_FAMILY = "幼圆"
RUSSIAN_FONT_SIZE = 22

# 无主题知识点的默认收纳类别（主题被删除时，其知识点归入此处）
DEFAULT_THEME = "默认"

# ---------- 多 AI 共建 ----------
# 打卡留痕的 Markdown 镜像（供人或 AI 直接阅读；数据源为 data/ai_cobuild.json）
COBUILD_LOG_PATH = BASE_DIR / "docs" / "多AI共建日志.md"