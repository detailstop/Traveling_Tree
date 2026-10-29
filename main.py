"""
旅行之木 Web 宿主入口。

用法：
    python main.py                 # 启动本地 Web UI（浏览器自动打开）

数据库 schema、插件 schema、插件迁移与 seed 全部由 manifest 驱动；
主程序不包含学习业务路由。经典 GUI / CLI 已随学习核心插件化退役。
"""

import sys
from pathlib import Path

# 保证项目根目录在 sys.path 中，使顶层 import 生效
sys.path.insert(0, str(Path(__file__).resolve().parent))

from db.connection import init_db


def bootstrap() -> None:
    """确保数据库可用；插件 seed 由 init_db 在全新库上自动执行。"""
    try:
        ran = init_db()
    except RuntimeError as exc:
        print(f"[db] {exc}", file=sys.stderr)
        print("[db] 数据库未就绪，已中止启动。", file=sys.stderr)
        raise SystemExit(1) from exc
    if ran:
        print("[db] schema / 迁移已执行一次")


def main() -> None:
    if sys.argv[1:]:
        print("GUI / CLI 入口已退役；请直接运行 python main.py 启动 Web 宿主。", file=sys.stderr)
        raise SystemExit(2)
    bootstrap()
    from ui.web.server import serve
    serve()


if __name__ == "__main__":
    main()
