"""PDF 与压缩插件 · 后端业务逻辑（P4 批 1）

由 ui/web/server.py 的 `/api/plugin/pdf/*` 动态加载；业务规则从
`modules/pdf_tools.py` 原样承接（合并/分割/压缩/图片转 PDF/批量压缩
均未改动）。pikepdf 与 Pillow 在使用函数内延迟导入，缺失时由 handle()
返回结构化 missing_dependency；`batch/scan` 不依赖二者，缺依赖仍可用。
"""
from __future__ import annotations

import base64
import io
import os
import re
import zipfile
from pathlib import Path

MAX_FILES = 200
MAX_BYTES = 400 * 1024 * 1024  # 上传总大小上限（解码前 base64 长度折算）
PDF_EXT = {".pdf"}
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tiff", ".tif"}


def _missing_dependency(exc: ImportError) -> dict:
    name = getattr(exc, "name", "") or ""
    hint = ("安装 Pillow 后可用（pip install Pillow）"
            if "PIL" in name else "安装 pikepdf 后可用（pip install pikepdf）")
    return {"ok": False, "error": "missing_dependency", "hint": hint,
            "detail": str(exc), "__status__": 500}



def _safe_name(name: str) -> str:
    base = Path(name or "file").name
    base = re.sub(r"[^\w\u4e00-\u9fff.\- ]", "_", base)
    return base[:120] or "file"


def decode_files(raw: list) -> list[dict]:
    """把 [{name, data(base64)}] 解码为 [{name, data(bytes)}] 并做基础校验。"""
    files: list[dict] = []
    total = 0
    for f in raw or []:
        name = _safe_name(str(f.get("name", "")))
        b64 = f.get("data") or ""
        try:
            data = base64.b64decode(b64, validate=True)
        except Exception as exc:
            raise ValueError(f"{name}: 数据不是有效的 base64") from exc
        total += len(data)
        files.append({"name": name, "data": data})
    if not files:
        raise ValueError("没有收到文件")
    if len(files) > MAX_FILES:
        raise ValueError(f"文件数量超过上限（{MAX_FILES}）")
    if total > MAX_BYTES:
        raise ValueError("文件总大小超过上限（400MB）")
    return files


def _check_ext(name: str, ok_exts: set[str]) -> None:
    if Path(name).suffix.lower() not in ok_exts:
        raise ValueError(f"{name}: 文件类型不支持")


# ---------------- 合并 ----------------
def merge(raw_files: list) -> bytes:
    import pikepdf
    files = decode_files(raw_files)
    if len(files) < 2:
        raise ValueError("至少需要 2 个 PDF 才能合并")
    buf = io.BytesIO()
    with pikepdf.Pdf.new() as out:
        for f in files:
            _check_ext(f["name"], PDF_EXT)
            try:
                with pikepdf.open(io.BytesIO(f["data"])) as src:
                    out.pages.extend(src.pages)
            except Exception as exc:
                raise ValueError(f"{f['name']}: 无法读取（可能已损坏或加密）") from exc
        out.save(buf, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    return buf.getvalue()


# ---------------- 分割 ----------------
def split(raw_file: dict, mode: str = "range", pages: str = "", every: int = 2) -> tuple[bytes, str, str]:
    """返回 (内容, 文件名, mime)。mode: range=指定范围 / each=每页一份 / every=每 N 页一份。"""
    import pikepdf
    files = decode_files([raw_file])
    f = files[0]
    _check_ext(f["name"], PDF_EXT)
    try:
        pdf = pikepdf.open(io.BytesIO(f["data"]))
    except Exception as exc:
        raise ValueError("无法读取 PDF（可能已损坏或加密）") from exc
    n = len(pdf.pages)
    try:
        if mode == "each":
            parts = [(i, i) for i in range(1, n + 1)]
        elif mode == "every":
            if not isinstance(every, int) or every < 1 or every > n:
                raise ValueError(f"每份页数需在 1~{n} 之间")
            parts = [(s, min(s + every - 1, n)) for s in range(1, n + 1, every)]
        else:  # range
            spec = (pages or "").replace("，", ",").strip()
            if not spec:
                raise ValueError("请填写页面范围，如 1-3,5,7-9")
            parts = []
            for token in spec.split(","):
                token = token.strip()
                if not token:
                    continue
                if "-" in token:
                    a, b = (int(x) for x in token.split("-", 1))
                    if a < 1 or b > n or a > b:
                        raise ValueError(f"范围 {token} 超出文档页数（{n} 页）")
                    parts.append((a, b))
                else:
                    i = int(token)
                    if i < 1 or i > n:
                        raise ValueError(f"页码 {i} 超出文档页数（{n} 页）")
                    parts.append((i, i))
            if not parts:
                raise ValueError("页面范围为空")

        if len(parts) == 1:
            a, b = parts[0]
            buf = io.BytesIO()
            with pikepdf.Pdf.new() as out:
                out.pages.extend(pdf.pages[a - 1:b])
                out.save(buf, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
            return buf.getvalue(), f"split_{a}-{b}.pdf", "application/pdf"

        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as z:
            for idx, (a, b) in enumerate(parts, 1):
                obuf = io.BytesIO()
                with pikepdf.Pdf.new() as out:
                    out.pages.extend(pdf.pages[a - 1:b])
                    out.save(obuf, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
                z.writestr(f"split_{a:02d}-{b:02d}.pdf", obuf.getvalue())
        return zbuf.getvalue(), "split.zip", "application/zip"
    finally:
        pdf.close()


# ---------------- 压缩 ----------------
def _recompress_images(pdf, quality: int) -> None:
    """对页内光栅图像重编码为 JPEG（跳过带透明蒙版 / 复杂解码参数的图）。"""
    import pikepdf
    from PIL import Image
    for page in pdf.pages:
        res = page.get("/Resources", pikepdf.Dictionary())
        xobj = res.get("/XObject", pikepdf.Dictionary())
        for name in list(xobj.keys()):
            img = xobj[name]
            if img.get("/Subtype") != pikepdf.Name("/Image"):
                continue
            if pikepdf.Name("/SMask") in img or pikepdf.Name("/Mask") in img:
                continue
            try:
                w, h = int(img.get("/Width")), int(img.get("/Height"))
                cs = img.get("/ColorSpace", pikepdf.Name("/DeviceRGB"))
                mode = "L" if cs == pikepdf.Name("/DeviceGray") else "RGB"
                im = Image.open(io.BytesIO(img.read_bytes()))
                if im.mode in ("RGBA", "LA", "P", "CMYK", "I;16"):
                    im = im.convert("RGB")
                if im.mode != mode:
                    im = im.convert(mode)
                buf = io.BytesIO()
                im.save(buf, "JPEG", quality=quality, optimize=True)
                imgdict = pikepdf.Dictionary(
                    Type=pikepdf.Name("/XObject"),
                    Subtype=pikepdf.Name("/Image"),
                    Width=w,
                    Height=h,
                    BitsPerComponent=8,
                    ColorSpace=pikepdf.Name("/DeviceRGB") if mode == "RGB" else pikepdf.Name("/DeviceGray"),
                    Filter=pikepdf.Name("/DCTDecode"),
                )
                xobj[name] = pdf.make_stream(buf.getvalue(), imgdict)
            except Exception:
                continue  # 复杂图像保持原样，不阻断压缩


def compress(raw_file: dict, level: int = 1) -> tuple[bytes, int, int]:
    """返回 (新内容, 原始大小, 新大小)。level: 0 无损重写 / 1 去冗余 / 2 图片重编码。"""
    import pikepdf
    files = decode_files([raw_file])
    f = files[0]
    _check_ext(f["name"], PDF_EXT)
    try:
        pdf = pikepdf.open(io.BytesIO(f["data"]))
    except Exception as exc:
        raise ValueError("无法读取 PDF（可能已损坏或加密）") from exc
    try:
        if level >= 1:
            pdf.remove_unreferenced_resources()
        if level >= 2:
            _recompress_images(pdf, quality=68)
        buf = io.BytesIO()
        pdf.save(
            buf,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
        )
        new = buf.getvalue()
        return new, len(f["data"]), len(new)
    finally:
        pdf.close()


# ---------------- 压缩图片 ----------------
def compress_images(raw_files: list, quality: int = 70) -> tuple[bytes, str, str, int, int]:
    """返回 (内容, 文件名, mime, 原始总大小, 新总大小)。多张打包 zip，单张直接返回 jpg。"""
    from PIL import Image
    files = decode_files(raw_files)
    for f in files:
        _check_ext(f["name"], IMG_EXT)
    quality = max(20, min(int(quality), 95))
    results: list[tuple[str, bytes]] = []
    orig_total = 0
    for f in files:
        try:
            im = Image.open(io.BytesIO(f["data"]))
            im.load()
        except Exception as exc:
            raise ValueError(f"{f['name']}: 无法读取图片") from exc
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, "white")
            im = im.convert("RGBA")
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        out = buf.getvalue()
        orig_total += len(f["data"])
        results.append((Path(f["name"]).stem + ".jpg", out))

    if not results:
        raise ValueError("没有可处理的图片")
    new_total = sum(len(d) for _, d in results)
    if len(results) == 1:
        name, data = results[0]
        return data, name, "image/jpeg", orig_total, new_total
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in results:
            z.writestr(name, data)
    return zbuf.getvalue(), "compressed_images.zip", "application/zip", orig_total, new_total


# ---------------- 批量压缩（按路径扫描 → 原位替换） ----------------
IMG_SCAN_EXT = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"}
PDF_SCAN_EXT = {".pdf"}


def _norm_path(path: str) -> Path:
    p = Path(str(path or "").strip().strip('"\''))
    if not p.exists():
        raise ValueError("路径不存在")
    if not p.is_dir():
        raise ValueError("路径不是文件夹")
    return p


def scan_folder(path: str, min_kb: int = 200) -> list[dict]:
    """扫描当前文件夹（不递归子文件夹）中超过大小阈值的图片 / PDF。"""
    folder = _norm_path(path)
    min_bytes = max(0, int(min_kb)) * 1024
    out = []
    for f in sorted(folder.iterdir()):
        if not f.is_file():
            continue  # 仅当前文件夹的文件
        ext = f.suffix.lower()
        kind = "pdf" if ext in PDF_SCAN_EXT else ("image" if ext in IMG_SCAN_EXT else None)
        if not kind:
            continue
        size = f.stat().st_size
        if size < min_bytes:
            continue
        out.append({"name": f.name, "size": size, "kind": kind, "ext": ext[1:]})
    return out


def _compress_pdf_bytes(data: bytes, level: int) -> bytes:
    import pikepdf
    with pikepdf.open(io.BytesIO(data)) as pdf:
        if level >= 1:
            pdf.remove_unreferenced_resources()
        if level >= 2:
            _recompress_images(pdf, quality=68)
        buf = io.BytesIO()
        pdf.save(buf, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        return buf.getvalue()


def _compress_image_bytes(data: bytes, ext: str, quality: int) -> bytes | None:
    """保持原格式压缩：jpg/webp 按质量重编码，png 无损 optimize，tiff 用 LZW。"""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as exc:
        raise ValueError(f"无法读取图片: {exc}") from exc
    buf = io.BytesIO()
    if ext in ("jpg", "jpeg"):
        im = im.convert("RGB")
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    elif ext == "png":
        level = 6 if quality >= 80 else 8 if quality >= 60 else 9
        im.save(buf, "PNG", optimize=True, compress_level=level)
    elif ext == "webp":
        im.save(buf, "WEBP", quality=quality, method=6)
    elif ext in ("tiff", "tif"):
        im.save(buf, "TIFF", compression="tiff_lzw")
    else:
        return None
    return buf.getvalue()


# 目标压缩率模式：迭代档位（先降质量，再降分辨率）
_AGGR_QS = (85, 55, 25)
_AGGR_SCALES = (0.8, 0.6, 0.4)
_AGGR_SQ = (55, 25)


def _encode_at(im, ext: str, quality: int, scale: float) -> bytes:
    from PIL import Image
    if scale and scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)),
                        max(1, int(im.height * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    if ext in ("jpg", "jpeg"):
        im.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    elif ext == "png":
        lvl = 6 if quality >= 80 else 8 if quality >= 60 else 9
        im.save(buf, "PNG", optimize=True, compress_level=lvl)
    elif ext == "webp":
        im.save(buf, "WEBP", quality=quality, method=6)
    elif ext in ("tiff", "tif"):
        if quality >= 80:
            im.save(buf, "TIFF", compression="tiff_lzw")
        else:
            im.save(buf, "TIFF", compression="jpeg", quality=quality)
    return buf.getvalue()


def _compress_image_aggressive(data: bytes, ext: str, ratio: float) -> bytes:
    """按目标压缩率（0~1）强力压缩：先逐档降质量，再逐档降分辨率，允许画质损失。
    返回体积最小的可达结果；无法达标时也返回最小体积（由调用方决定是否替换）。"""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as exc:
        raise ValueError(f"无法读取图片: {exc}") from exc
    target = int(len(data) * ratio)
    best = None
    # 1) 原分辨率：质量试探（PNG 无损编码只需一次）
    qs = _AGGR_QS if ext not in ("png",) else (85,)
    for q in qs:
        out = _encode_at(im, ext, q, 1.0)
        if best is None or len(out) < len(best):
            best = out
        if len(out) <= target:
            return out
    # 2) 降分辨率：每档试两种质量
    for scale in _AGGR_SCALES:
        for q in _AGGR_SQ:
            out = _encode_at(im, ext, q, scale)
            if len(out) < len(best):
                best = out
            if len(out) <= target:
                return out
    return best


def _validate_out(ext: str, tmp: Path) -> None:
    """替换前校验产物可正常打开，避免写坏原文件。"""
    if ext == ".pdf":
        import pikepdf
        with pikepdf.open(tmp):
            pass
    else:
        from PIL import Image
        with Image.open(tmp) as im:
            im.load()


def compress_folder(path: str, min_kb: int = 200,
                    img_quality: int = 70, pdf_level: int = 1,
                    target_ratio: int = 0) -> list[dict]:
    """批量压缩并原位替换。返回每个文件的处理结果。
    target_ratio>0 时图片启用目标压缩率模式（0~100，允许画质损失）。"""
    folder = _norm_path(path)
    img_quality = max(20, min(int(img_quality), 95))
    pdf_level = max(0, min(int(pdf_level), 2))
    ratio = max(0, min(int(target_ratio), 100)) / 100.0

    def _process(f: dict) -> dict:
        src = folder / f["name"]
        try:
            raw = src.read_bytes()
            if f["kind"] == "pdf":
                new = _compress_pdf_bytes(raw, pdf_level)
            elif ratio > 0:
                new = _compress_image_aggressive(raw, f["ext"], ratio)
            else:
                new = _compress_image_bytes(raw, f["ext"], img_quality)
            if new is None or len(new) >= f["size"]:
                return {**f, "ok": True, "new_size": f["size"], "skipped": True,
                        "error": "已无可压缩空间，保留原文件"}
            tmp = src.with_name(f".batch_tmp_{src.name}")
            tmp.write_bytes(new)
            _validate_out(src.suffix.lower(), tmp)
            os.replace(tmp, src)  # 原子替换：先写临时文件校验，再覆盖
            return {**f, "ok": True, "new_size": len(new)}
        except Exception as exc:
            return {**f, "ok": False, "new_size": f["size"], "error": str(exc)}

    scanned = scan_folder(path, min_kb)
    if ratio > 0 and len(scanned) > 1:
        # 目标压缩率模式：多文件并行加速
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(4, len(scanned))) as ex:
            results = list(ex.map(_process, scanned))
    else:
        results = [_process(f) for f in scanned]
    return results


# ---------------- 图片转 PDF ----------------
def images_to_pdf(raw_files: list, paper: str = "a4", orient: str = "portrait") -> bytes:
    from PIL import Image
    files = decode_files(raw_files)
    for f in files:
        _check_ext(f["name"], IMG_EXT)
    sizes = {"a4": (595, 842), "a3": (842, 1191)}  # pt
    if orient != "portrait":
        sizes = {k: (v[1], v[0]) for k, v in sizes.items()}

    pages: list[Image.Image] = []
    for f in files:
        try:
            im = Image.open(io.BytesIO(f["data"]))
            im.load()
        except Exception as exc:
            raise ValueError(f"{f['name']}: 无法读取图片") from exc
        im = im.convert("RGB")
        if paper == "fit":
            pages.append(im)
            continue
        pw, ph = sizes.get(paper, sizes["a4"])
        scale = min(pw * 0.92 / im.width, ph * 0.92 / im.height)
        nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        im = im.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGB", (pw, ph), "white")
        canvas.paste(im, ((pw - nw) // 2, (ph - nh) // 2))
        pages.append(canvas)

    if not pages:
        raise ValueError("没有可处理的图片")
    buf = io.BytesIO()
    # 144dpi：像素数 ≈ 点数，保证 fit 模式与原图 1:1 尺寸
    pages[0].save(
        buf, "PDF", resolution=144.0,
        save_all=True, append_images=pages[1:],
    )
    return buf.getvalue()


# ------------------------------------------------------------
# 插件分发入口：subpath = <section>/<action>
# ------------------------------------------------------------

_PDF_LABELS = {
    "merge": "合并失败",
    "split": "分割失败",
    "compress": "压缩失败",
    "images": "图片转 PDF 失败",
    "compress-images": "图片压缩失败",
}


def _binary(body: bytes, mime: str, filename: str, headers: dict | None = None) -> dict:
    return {"__binary__": True, "body": body, "mime": mime,
            "filename": filename, "headers": headers or {}}


def _bad_request(message: str) -> dict:
    return {"ok": False, "error": message, "__status__": 400}


def _server_error(message: str) -> dict:
    return {"ok": False, "error": message, "__status__": 500}


def handle(method: str, subpath: str, query: dict, body: dict) -> dict:
    """处理 `/api/plugin/pdf/<section>/<action>`。

    pdf/merge、pdf/split、pdf/compress、pdf/images、pdf/compress-images；
    batch/scan、batch/compress。未知 section/action 返回 not_found。
    """
    if method != "POST":
        return {"ok": False, "error": "method_not_allowed"}
    parts = [p for p in (subpath or "").strip("/").split("/") if p]
    if len(parts) != 2:
        return {"ok": False, "error": "not_found"}
    section, action = parts
    payload = body if isinstance(body, dict) else {}

    try:
        if section == "pdf":
            if action == "merge":
                return _binary(merge(payload.get("files", [])),
                               "application/pdf", "merged.pdf")
            if action == "split":
                data, name, mime = split(
                    payload.get("file", {}), payload.get("mode", "range"),
                    payload.get("pages", ""), int(payload.get("every") or 2))
                return _binary(data, mime, name)
            if action == "compress":
                data, orig, new = compress(
                    payload.get("file", {}), int(payload.get("level") or 1))
                return _binary(data, "application/pdf", "compressed.pdf",
                               {"X-Orig-Size": str(orig), "X-New-Size": str(new)})
            if action == "images":
                return _binary(
                    images_to_pdf(payload.get("files", []),
                                  payload.get("paper", "a4"),
                                  payload.get("orient", "portrait")),
                    "application/pdf", "images.pdf")
            if action == "compress-images":
                data, name, mime, orig, new = compress_images(
                    payload.get("files", []), int(payload.get("quality") or 70))
                return _binary(data, mime, name,
                               {"X-Orig-Size": str(orig), "X-New-Size": str(new)})
            return {"ok": False, "error": "not_found"}

        if section == "batch":
            if action == "scan":
                min_kb = payload.get("min_kb")
                min_kb = 200 if min_kb in (None, "") else int(min_kb)
                files = scan_folder(payload.get("path", ""), min_kb)
                return {"ok": True, "files": files, "count": len(files)}
            if action == "compress":
                min_kb = payload.get("min_kb")
                min_kb = 200 if min_kb in (None, "") else int(min_kb)
                iq = payload.get("img_quality")
                iq = 70 if iq in (None, "") else int(iq)
                plv = payload.get("pdf_level")
                plv = 1 if plv in (None, "") else int(plv)
                tr = payload.get("target_ratio")
                tr = 0 if tr in (None, "") else max(0, min(int(tr), 100))
                results = compress_folder(
                    payload.get("path", ""), min_kb, iq, plv, tr)
                done = sum(1 for r in results if r.get("ok") and not r.get("skipped"))
                skipped = sum(1 for r in results if r.get("skipped"))
                failed = sum(1 for r in results if not r.get("ok"))
                return {"ok": True, "results": results, "count": len(results),
                        "done": done, "skipped": skipped, "failed": failed}
            return {"ok": False, "error": "not_found"}
        return {"ok": False, "error": "not_found"}
    except ImportError as exc:
        return _missing_dependency(exc)
    except ValueError as exc:
        if section == "pdf":
            return _bad_request(str(exc))
        return {"ok": False, "error": str(exc)}
    except Exception as exc:
        label = _PDF_LABELS.get(action, "处理失败") if section == "pdf" else "处理失败"
        if section == "pdf":
            return _server_error(f"{label}: {exc}")
        return {"ok": False, "error": f"{label}: {exc}"}
