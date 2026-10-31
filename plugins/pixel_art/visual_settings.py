"""visual_settings 共享读写（pixel_art / book_reader 共用）。"""

import json

from db.connection import get_conn


def get_visual_setting(key: str):
    return get_conn().execute(
        "SELECT value FROM visual_settings WHERE settings_key=?", (key,)
    ).fetchone()


def save_visual_setting(key: str, value: str, updated_at: str) -> None:
    get_conn().execute(
        "INSERT INTO visual_settings(settings_key,value,updated_at,raw_json) VALUES(?,?,?,?) "
        "ON CONFLICT(settings_key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, "
        "raw_json=excluded.raw_json",
        (key, value, updated_at,
         json.dumps({"settings_key": key, "value": value, "updated_at": updated_at}, ensure_ascii=False)),
    )
    get_conn().commit()
