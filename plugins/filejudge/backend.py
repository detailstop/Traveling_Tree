"""
文件判官插件 · 后端业务逻辑（P3 批 2）

由 ui/web/server.py 的 `/api/plugin/filejudge/*` 动态加载；业务规则从
`modules/file_judge.py` 原样承接（扫描、类型/大小筛选、预览、缩略图、
保留清单、删除、目录树均未改动）。数据文件迁至
`data/plugins/filejudge/keep.json`，首次加载时从旧 `data/filejudge_keep.json`
复制一次，旧文件保留不删。

仅处理当前目录第一层（不含子文件夹），与批量压缩口径一致。
"""
from __future__ import annotations

import base64
import io
import json
import os
import shutil
import sys
from pathlib import Path

_PLUGIN_DIR = Path(__file__).resolve().parent
_ROOT = _PLUGIN_DIR.parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import config

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
PDF_EXT = {".pdf"}
DOC_EXT = {".doc", ".docx"}
TXT_EXT = {".txt", ".md", ".rst", ".log", ".csv"}
KIND_LABEL = {"img": "图片", "pdf": "PDF", "doc": "文档", "txt": "文本"}


def classify(name: str) -> str | None:
    ext = Path(name).suffix.lower()
    if ext in IMAGE_EXT:
        return "img"
    if ext in PDF_EXT:
        return "pdf"
    if ext in DOC_EXT:
        return "doc"
    if ext in TXT_EXT:
        return "txt"
    return None


def _plugin_dir() -> Path:
    return config.plugin_data_dir("filejudge")


def _keep_path() -> Path:
    """「已保留」清单文件：data/plugins/filejudge/keep.json。"""
    return _plugin_dir() / "keep.json"


def _legacy_keep_path() -> Path:
    return Path(config.DATA_DIR) / "filejudge_keep.json"


def _ensure_keep() -> None:
    """首次使用时复制旧 data/filejudge_keep.json；无旧文件则落默认空清单。"""
    target = _keep_path()
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    legacy = _legacy_keep_path()
    if legacy.is_file():
        shutil.copyfile(legacy, target)
    else:
        target.write_text(json.dumps({"paths": []}, ensure_ascii=False, indent=2),
                          encoding="utf-8")


def _missing_dependency(package: str, exc: Exception) -> dict:
    return {
        "ok": False,
        "error": "missing_dependency",
        "hint": f"安装 {package} 后可用（pip install {package}）",
        "detail": str(exc),
    }


def _load_kept() -> set:
    _ensure_keep()
    try:
        data = json.loads(_keep_path().read_text(encoding="utf-8"))
        return {str(x) for x in data.get("paths", [])}
    except Exception:
        return set()


def _save_kept(paths: set) -> None:
    _ensure_keep()
    _keep_path().parent.mkdir(parents=True, exist_ok=True)
    _keep_path().write_text(
        json.dumps({"paths": sorted(paths)}, ensure_ascii=False, indent=2),
        encoding="utf-8")



def mark_keep(path: str) -> dict:
    """记录「已保留」文件：后续扫描该目录时自动略过。"""
    kept = _load_kept()
    kept.add(str(Path(path or "").resolve()))
    _save_kept(kept)
    return {"ok": True, "kept": len(kept)}


def scan(path: str, types: list[str], size_kb: float, cmp: str) -> dict:
    """扫描当前目录第一层，按类型与大小阈值过滤。cmp: gt=大于, lt=小于。"""
    folder = Path(path or "").expanduser()
    if not folder.is_dir():
        return {"ok": False, "error": f"目录不存在：{folder}"}
    want = set(types or [])
    kept = _load_kept()
    files = []
    skipped = 0
    for entry in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_file():
            continue
        kind = classify(entry.name)
        if kind is None or (want and kind not in want):
            continue
        if str(entry.resolve()) in kept:
            skipped += 1
            continue
        size = entry.stat().st_size
        kb = size / 1024.0
        if cmp == "gt" and kb <= size_kb:
            continue
        if cmp == "lt" and kb >= size_kb:
            continue
        files.append({
            "path": str(entry),
            "name": entry.name,
            "size": size,
            "kb": round(kb, 1),
            "kind": kind,
            "kind_label": KIND_LABEL.get(kind, kind),
        })
    return {"ok": True, "files": files, "count": len(files), "skipped": skipped}


def preview(path: str) -> dict:
    """返回单文件预览：图片→base64 缩略图；其余→首页内容文本。"""
    p = Path(path or "")
    if not p.is_file():
        return {"ok": False, "error": f"文件不存在：{p}"}
    kind = classify(p.name)
    if kind is None:
        return {"ok": False, "error": "不支持的文件类型"}
    try:
        if kind == "img":
            return _preview_image(p)
        if kind == "pdf":
            return _preview_pdf(p)
        if kind == "doc":
            return _preview_doc(p)
        return _preview_text(p)
    except Exception as exc:
        return {"ok": False, "error": f"预览失败：{exc}"}


def _preview_image(p: Path) -> dict:
    try:
        from PIL import Image
    except ImportError as exc:
        return _missing_dependency("Pillow", exc)
    img = Image.open(p)
    img.load()
    # JPEG 不支持 alpha：透明图先合成白底，其余模式统一转 RGB
    if img.mode in ("RGBA", "LA", "PA"):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    if max(img.size) > 640:
        scale = 640 / max(img.size)
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82)
    return {"ok": True, "kind": "image",
            "data": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")}


def _preview_pdf(p: Path) -> dict:
    try:
        from PyPDF2 import PdfReader
    except ImportError as exc:
        return _missing_dependency("PyPDF2", exc)
    reader = PdfReader(str(p))
    text = ""
    if len(reader.pages) > 0:
        text = (reader.pages[0].extract_text() or "").strip()
    if not text:
        text = "（该 PDF 首页未提取到文本，可能是扫描件）"
    return {"ok": True, "kind": "text", "title": f"PDF · 共 {len(reader.pages)} 页",
            "text": text[:1200]}


def _preview_doc(p: Path) -> dict:
    if p.suffix.lower() == ".docx":
        try:
            import docx
        except ImportError as exc:
            return _missing_dependency("python-docx", exc)
        doc = docx.Document(str(p))
        paras = [x.text.strip() for x in doc.paragraphs[:12] if x.text.strip()]
        text = "\n".join(paras) if paras else "（文档首页无文本段落）"
        return {"ok": True, "kind": "text", "title": "DOCX 文档首页", "text": text[:1200]}
    return {"ok": True, "kind": "text", "title": "DOC 文档",
            "text": "（旧版 .doc 二进制格式暂不支持文本预览，可改存为 .docx 后预览）"}


def _preview_text(p: Path) -> dict:
    raw = p.read_bytes()[:2400]
    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()[:40]
    text = "\n".join(lines)
    return {"ok": True, "kind": "text", "title": "文本文件", "text": text}


def thumbs(paths: list[str], size: int = 120) -> dict:
    """批量生成小缩略图（仅图片；短边≤size，JPEG q70）。非图片/失败返回占位。"""
    try:
        from PIL import Image
    except ImportError as exc:
        return _missing_dependency("Pillow", exc)
    out = []
    for p in paths:
        f = Path(p or "")
        item = {"path": str(f), "data": None, "err": None}
        if not f.is_file():
            item["err"] = "不存在"
            out.append(item)
            continue
        if classify(f.name) != "img":
            out.append(item)
            continue
        try:
            img = Image.open(f)
            img.load()
            if img.mode in ("RGBA", "LA", "PA"):
                rgba = img.convert("RGBA")
                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                bg.paste(rgba, mask=rgba.split()[-1])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            if min(img.size) > size:
                scale = size / min(img.size)
                img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))),
                                 Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=70)
            item["data"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception as exc:
            item["err"] = str(exc)
        out.append(item)
    return {"ok": True, "thumbs": out}


def delete(paths: list[str]) -> dict:
    """批量删除（调用前需用户确认）。返回成功/失败明细。"""
    deleted, errors = [], []
    for p in paths:
        f = Path(p or "")
        try:
            if f.is_file():
                f.unlink()
                deleted.append(f.name)
            else:
                errors.append(f"{f.name}：不存在")
        except OSError as exc:
            errors.append(f"{f.name}：{exc}")
    return {"ok": not errors or bool(deleted), "deleted": deleted,
            "errors": errors, "count": len(deleted)}


def tree(path: str) -> dict:
    """递归扫描目录，生成树状占用分布（全部读取，不截断）。

    每个节点：{name, path, size(字节), kind, children[]}，文件夹 size = 子树合计。
    大目录可能产生大量节点与较大 JSON，前端按节点数自动切换列表视图。
    """
    folder = Path(path or "").expanduser()
    if not folder.is_dir():
        return {"ok": False, "error": f"目录不存在：{folder}"}

    def walk(p: Path, depth: int):
        try:
            entries = list(p.iterdir())
        except OSError:
            return None
        total = 0
        children = []
        for e in sorted(entries, key=lambda x: x.name.lower()):
            try:
                if e.is_dir():
                    sub = walk(e, depth + 1)
                    if sub is not None:
                        children.append(sub)
                        total += sub["size"]
                elif e.is_file():
                    sz = e.stat().st_size
                    total += sz
                    children.append({"name": e.name, "path": str(e), "size": sz,
                                     "kind": classify(e.name) or "other", "children": []})
            except OSError:
                continue
        return {"name": p.name or str(p), "path": str(p), "size": total,
                "kind": "dir", "children": children}

    root = walk(folder, 0)
    if root is None:
        return {"ok": False, "error": "目录不可读"}
    return {"ok": True, "root": root, "truncated": False}


def reveal(path: str) -> dict:
    """在系统文件管理器中定位：文件→选中；文件夹→打开。"""
    import subprocess
    p = Path(path or "").expanduser()
    if not p.exists():
        return {"ok": False, "error": "路径不存在"}
    try:
        if p.is_dir():
            subprocess.Popen(["explorer", str(p.resolve())])
        else:
            subprocess.Popen(["explorer", "/select,", str(p.resolve())])
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": f"打开失败：{exc}"}


# ------------------------------------------------------------
# 插件分发入口：子路径与旧 /api/filejudge/* 一一对应（均为 POST）
# ------------------------------------------------------------

_METHODS = {
    "scan": {"POST"},
    "preview": {"POST"},
    "thumbs": {"POST"},
    "keep": {"POST"},
    "tree": {"POST"},
    "reveal": {"POST"},
    "delete": {"POST"},
}


def handle(method: str, subpath: str, query: dict, body: dict) -> dict:
    """处理 `/api/plugin/filejudge/<subpath>`。"""
    subpath = (subpath or "").strip("/")
    allowed = _METHODS.get(subpath)
    if allowed is None:
        return {"ok": False, "error": "not_found"}
    if method not in allowed:
        return {"ok": False, "error": "method_not_allowed"}
    payload = body if isinstance(body, dict) else {}
    if subpath == "scan":
        try:
            size_kb = float(payload.get("size_kb") or 0)
        except (TypeError, ValueError):
            return {"ok": False, "error": "size_kb 必须是数字"}
        return scan(
            str(payload.get("path") or ""),
            [str(t) for t in (payload.get("types") or [])],
            size_kb,
            str(payload.get("cmp") or "gt"),
        )
    if subpath == "preview":
        return preview(str(payload.get("path") or ""))
    if subpath == "thumbs":
        return thumbs([str(p) for p in (payload.get("paths") or [])])
    if subpath == "keep":
        return mark_keep(str(payload.get("path") or ""))
    if subpath == "tree":
        return tree(str(payload.get("path") or ""))
    if subpath == "reveal":
        return reveal(str(payload.get("path") or ""))
    if subpath == "delete":
        return delete([str(p) for p in (payload.get("paths") or [])])
    return {"ok": False, "error": "not_found"}
