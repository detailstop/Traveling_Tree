"""One-time settings split: copy business keys to plugin settings files.

Does not delete the old host keys. Existing plugin keys win over host values.
Only key names are printed; pricing values are never printed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from modules import settings_store

HOST = settings_store.DEFAULT_SETTINGS_PATH
RUSSIAN_KEYS = ("ru_family", "ru_size", "new_quota", "review_quota")
MODEL_KEYS = ("model_pricing",)


def _merge(path: Path, keys: tuple[str, ...]) -> list[str]:
    host = settings_store.read_at(HOST)
    existing = settings_store.read_at(path)
    incoming = {k: host[k] for k in keys if k in host}
    merged = dict(incoming)
    merged.update(existing)  # existing plugin values must not be overwritten
    if not settings_store.write_at(path, merged):
        raise SystemExit(f"写入失败：{path}")
    return sorted(merged)


def main() -> int:
    russian_path = settings_store.plugin_settings_path("russian")
    model_path = settings_store.plugin_settings_path("model_usage")
    host_keys = sorted(settings_store.read_at(HOST).keys())
    russian_keys = _merge(russian_path, RUSSIAN_KEYS)
    model_keys = _merge(model_path, MODEL_KEYS)
    print("host keys:", ", ".join(host_keys))
    print("russian keys:", ", ".join(russian_keys))
    print("model_usage keys:", ", ".join(model_keys))
    print("migration ok (old host keys preserved)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
