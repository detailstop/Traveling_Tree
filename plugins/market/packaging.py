"""market 包安全模块：SHA256、ZIP 校验、解压到临时目录、原子安装/卸载。

只使用标准库；不依赖插件业务代码。
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import stat
import tempfile
import time
import zipfile
from pathlib import Path

MAX_FILES = 2000
MAX_TOTAL_BYTES = 50 * 1024 * 1024  # 50 MB
_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")


class MarketError(Exception):
    """安装/卸载失败；code 供接口返回。"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe_parts(name: str) -> list[str]:
    raw = str(name or "")
    if not raw or "\x00" in raw:
        raise MarketError("bad_zip", "ZIP 含非法条目名")
    if raw.startswith("/") or raw.startswith("\\") or re.match(r"^[A-Za-z]:", raw):
        raise MarketError("bad_zip", f"ZIP 含绝对路径：{raw}")
    if "\\" in raw:
        raise MarketError("bad_zip", f"ZIP 条目使用反斜杠：{raw}")
    parts = [p for p in raw.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise MarketError("bad_zip", f"ZIP 路径穿越：{raw}")
    return parts


def validate_and_extract(zip_bytes: bytes, dest: Path, expect_id: str) -> dict:
    """校验并解压到 dest；返回 manifest dict。dest 必须为空目录。"""
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise MarketError("bad_zip", f"不是有效 ZIP：{exc}") from exc
    infos = zf.infolist()
    if len(infos) > MAX_FILES:
        raise MarketError("too_many_files", f"文件数超限（>{MAX_FILES}）")
    total = sum(i.file_size for i in infos)
    if total > MAX_TOTAL_BYTES:
        raise MarketError("too_large", f"解压总大小超限（>{MAX_TOTAL_BYTES} 字节）")
    for info in infos:
        parts = _safe_parts(info.filename)
        mode = (info.external_attr >> 16) & 0o170000
        if mode == stat.S_IFLNK:
            raise MarketError("bad_zip", f"拒绝符号链接：{info.filename}")
        if info.is_dir():
            continue
        if not parts:
            continue
        target = dest.joinpath(*parts)
        try:
            target.resolve().relative_to(dest.resolve())
        except ValueError as exc:
            raise MarketError("bad_zip", f"路径越界：{info.filename}") from exc
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(info) as src, open(target, "wb") as out:
            shutil.copyfileobj(src, out)
    zf.close()
    manifest_path = dest / "manifest.json"
    if not manifest_path.is_file():
        raise MarketError("bad_package", "包根缺少 manifest.json")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise MarketError("bad_package", f"manifest.json 不可读：{exc}") from exc
    if not isinstance(manifest, dict) or str(manifest.get("id") or "") != expect_id:
        raise MarketError("id_mismatch", "manifest.id 与包/目标 id 不一致")
    if not _ID_RE.fullmatch(expect_id):
        raise MarketError("bad_id", f"非法插件 id：{expect_id}")
    return manifest


def install_package(entry: dict, zip_bytes: bytes, plugins_dir: Path, tmp_root: Path) -> dict:
    """SHA256 校验 → 解压临时目录 → 校验 manifest → 原子移动到 plugins/<id>。"""
    pid = str(entry.get("id") or "")
    expect_sha = str(entry.get("sha256") or "").lower()
    actual = sha256_bytes(zip_bytes)
    if not expect_sha or actual != expect_sha:
        raise MarketError("sha256_mismatch", f"SHA256 不符：期望 {expect_sha[:12]}…，实际 {actual[:12]}…")
    target = plugins_dir / pid
    if target.exists():
        raise MarketError("already_installed", f"插件已安装：{pid}")
    tmp_root.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix=f"install_{pid}_", dir=str(tmp_root)))
    try:
        manifest = validate_and_extract(zip_bytes, temp, pid)
        target.parent.mkdir(parents=True, exist_ok=True)
        os.replace(temp, target)
    except Exception:
        shutil.rmtree(temp, ignore_errors=True)
        raise
    return manifest


def remove_plugin(pid: str, plugins_dir: Path, trash_root: Path) -> Path:
    """把 plugins/<id> 移到 trash；返回备份路径（可回滚）。"""
    src = plugins_dir / pid
    if not src.is_dir():
        raise MarketError("not_installed", f"插件未安装：{pid}")
    trash_root.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    dst = trash_root / f"{pid}_{stamp}"
    n = 2
    while dst.exists():
        dst = trash_root / f"{pid}_{stamp}_{n}"
        n += 1
    shutil.move(str(src), str(dst))
    return dst


def backup_private_data(pid: str, data_plugins_dir: Path, backup_root: Path) -> Path | None:
    """备份 data/plugins/<id>/ 到 backup_root/uninstall_<id>_<ts>/；不存在返回 None。"""
    src = data_plugins_dir / pid
    if not src.exists():
        return None
    stamp = time.strftime("%Y%m%d_%H%M%S")
    dst = backup_root / f"uninstall_{pid}_{stamp}"
    dst.mkdir(parents=True, exist_ok=True)
    target = dst / "data"
    shutil.copytree(src, target, dirs_exist_ok=True)
    shutil.rmtree(src, ignore_errors=True)
    return dst


def backup_database(db_path: Path, backup_root: Path) -> Path:
    """整库副本（SQLite 在线备份）到 backup_root/russian_tutor.db.bak；不改原库。"""
    import sqlite3
    backup_root.mkdir(parents=True, exist_ok=True)
    dst = backup_root / "russian_tutor.db.bak"
    src = sqlite3.connect(str(db_path))
    out = sqlite3.connect(str(dst))
    try:
        src.backup(out)
    finally:
        out.close()
        src.close()
    return dst


def drop_test_tables(db_path: Path, tables: list[str]) -> list[str]:
    """仅删除 test_ 前缀的测试表（调用方须先做插件限定）。"""
    import sqlite3
    if any(not t.startswith("test_") for t in tables):
        raise MarketError("forbidden", "只允许删除 test_ 前缀测试表")
    conn = sqlite3.connect(str(db_path))
    try:
        for table in tables:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.commit()
    finally:
        conn.close()
    return tables
